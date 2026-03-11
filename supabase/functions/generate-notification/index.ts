import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface GenerateNotificationRequest {
  event: 'registration' | 'order_placed' | 'order_status_update'
  userId: string
  orderId?: string
}

interface ProfileRecord {
  id: string
  user_id: string
  full_name: string
  email: string
  phone?: string | null
  country?: string | null
}

interface OrderItem {
  product_name: string
  quantity: number
  price: number
}

interface OrderRecord {
  id: string
  created_at: string
  status: string
  total: number
  shipping_name: string
  shipping_country: string
  shipping_address?: string
  shipping_city?: string
  shipping_phone?: string
  order_items?: OrderItem[]
}

interface NotificationDraft {
  type: 'email' | 'whatsapp'
  event: GenerateNotificationRequest['event']
  recipient: string
  subject?: string
  message: string
  userId: string
  orderId?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { event, userId, orderId }: GenerateNotificationRequest = await req.json()

    const notifications = await generateNotifications(supabaseClient, event, userId, orderId)

    return new Response(
      JSON.stringify({ notifications }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    console.error('Error in generate-notification function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function generateNotifications(
  supabaseClient: SupabaseClient,
  event: GenerateNotificationRequest['event'],
  userId: string,
  orderId?: string,
) {
  const notifications: NotificationDraft[] = []

  // Get user profile
  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (profileError) {
    throw new Error('User profile not found')
  }

  if (event === 'registration') {
    // Welcome email
    const emailHtml = generateWelcomeEmail(profile)
    notifications.push({
      type: 'email',
      event: 'registration',
      recipient: profile.email,
      subject: 'Welcome to Nyalix Global Care!',
      message: emailHtml,
      userId
    })
  } else if (event === 'order_placed' && orderId) {
    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        order_items (
          product_name,
          quantity,
          price
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError) {
      throw new Error('Order not found')
    }

    // Invoice email
    const emailHtml = generateInvoiceEmail(profile, order)
    notifications.push({
      type: 'email',
      event: 'order_placed',
      recipient: profile.email,
      subject: `Order Confirmation - ${orderId}`,
      message: emailHtml,
      orderId,
      userId
    })

    // WhatsApp message
    const whatsappMessage = generateInvoiceWhatsApp(profile, order)
    if (profile.phone) {
      notifications.push({
        type: 'whatsapp',
        event: 'order_placed',
        recipient: profile.phone,
        message: whatsappMessage,
        orderId,
        userId
      })
    }
  } else if (event === 'order_status_update' && orderId) {
    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select(`
        *,
        order_items (
          product_name,
          quantity,
          price
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError) {
      throw new Error('Order not found')
    }

    // Status update email
    const emailHtml = generateStatusUpdateEmail(profile, order)
    notifications.push({
      type: 'email',
      event: 'order_status_update',
      recipient: profile.email,
      subject: `Order Status Update - ${orderId}`,
      message: emailHtml,
      orderId,
      userId
    })

    // WhatsApp message
    const whatsappMessage = generateStatusUpdateWhatsApp(profile, order)
    if (profile.phone) {
      notifications.push({
        type: 'whatsapp',
        event: 'order_status_update',
        recipient: profile.phone,
        message: whatsappMessage,
        orderId,
        userId
      })
    }
  }

  return notifications
}

function generateWelcomeEmail(profile: ProfileRecord): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://your-logo-url.com/logo.png" alt="Nyalix Global Care" style="max-width: 200px;">
        <h1>Welcome to Nyalix Global Care!</h1>
      </div>
      <div class="content">
        <h2>Dear ${profile.full_name},</h2>
        <p>Thank you for registering with Nyalix Global Care! We're excited to have you as part of our community.</p>
        <p>Your account has been successfully created with the following details:</p>
        <ul>
          <li><strong>Name:</strong> ${profile.full_name}</li>
          <li><strong>Email:</strong> ${profile.email}</li>
          <li><strong>Country:</strong> ${profile.country || 'Not specified'}</li>
        </ul>
        <p>You can now browse our catalog of medical equipment and place orders.</p>
        <p>If you have any questions, please don't hesitate to contact us.</p>
      </div>
      <div class="footer">
        <p>&copy; 2024 Nyalix Global Care. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

function generateInvoiceEmail(profile: ProfileRecord, order: OrderRecord): string {
  const itemsHtml = order.order_items?.map((item: OrderItem) => `
    <tr>
      <td>${item.product_name}</td>
      <td>${item.quantity}</td>
      <td>$${item.price}</td>
      <td>$${(item.quantity * item.price).toFixed(2)}</td>
    </tr>
  `).join('') ?? ''

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .invoice-table { width: 100%; border-collapse: collapse; }
        .invoice-table th, .invoice-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .invoice-table th { background-color: #f2f2f2; }
        .total { font-weight: bold; }
        .footer { background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://your-logo-url.com/logo.png" alt="Nyalix Global Care" style="max-width: 200px;">
        <h1>Order Invoice</h1>
      </div>
      <div class="content">
        <h2>Order ID: ${order.id}</h2>
        <p><strong>Customer:</strong> ${profile.full_name}</p>
        <p><strong>Email:</strong> ${profile.email}</p>
        <p><strong>Order Date:</strong> ${new Date(order.created_at).toLocaleDateString()}</p>
        
        <h3>Shipping Details:</h3>
        <p>${order.shipping_name}<br>
        ${order.shipping_address}<br>
        ${order.shipping_city}, ${order.shipping_country}<br>
        Phone: ${order.shipping_phone}${order.shipping_email ? `<br/>Email: ${order.shipping_email}` : ''}</p>
        
        <h3>Order Items:</h3>
        <table class="invoice-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr class="total">
              <td colspan="3">Total Amount</td>
              <td>$${order.total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        <p>Thank you for your business!</p>
      </div>
      <div class="footer">
        <p>&copy; 2024 Nyalix Global Care. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

function generateStatusUpdateEmail(profile: ProfileRecord, order: OrderRecord): string {
  const statusMessages = {
    pending: 'Your order is being processed.',
    processing: 'Your order is being prepared for shipment.',
    shipped: 'Your order has been shipped.',
    delivered: 'Your order has been delivered.',
    cancelled: 'Your order has been cancelled.'
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .status { font-size: 18px; font-weight: bold; color: #007bff; }
        .footer { background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <img src="https://your-logo-url.com/logo.png" alt="Nyalix Global Care" style="max-width: 200px;">
        <h1>Order Status Update</h1>
      </div>
      <div class="content">
        <h2>Order ID: ${order.id}</h2>
        <p>Dear ${profile.full_name},</p>
        <p class="status">Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</p>
        <p>${statusMessages[order.status as keyof typeof statusMessages] || 'Your order status has been updated.'}</p>
        <p>If you have any questions, please contact our support team.</p>
      </div>
      <div class="footer">
        <p>&copy; 2024 Nyalix Global Care. All rights reserved.</p>
      </div>
    </body>
    </html>
  `
}

function generateInvoiceWhatsApp(profile: ProfileRecord, order: OrderRecord): string {
  const itemsText = order.order_items?.map((item: OrderItem) => 
    `${item.product_name} x${item.quantity} - $${(item.quantity * item.price).toFixed(2)}`
  ).join('\n') ?? ''

  return `🛍️ *Order Confirmation*\n\nOrder ID: ${order.id}\n\nItems:\n${itemsText}\n\nTotal: $${order.total.toFixed(2)}\n\nShipping to: ${order.shipping_name}, ${order.shipping_address}, ${order.shipping_city}${order.shipping_email ? `, email: ${order.shipping_email}` : ''}${order.shipping_phone ? `, phone: ${order.shipping_phone}` : ''}\n\nThank you for shopping with Nyalix Global Care!`
}

function generateStatusUpdateWhatsApp(profile: ProfileRecord, order: OrderRecord): string {
  const statusMessages = {
    pending: 'Your order is being processed.',
    processing: 'Your order is being prepared for shipment.',
    shipped: 'Your order has been shipped.',
    delivered: 'Your order has been delivered.',
    cancelled: 'Your order has been cancelled.'
  }

  return `📦 *Order Status Update*\n\nOrder ID: ${order.id}\n\nStatus: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}\n\n${statusMessages[order.status as keyof typeof statusMessages] || 'Your order status has been updated.'}\n\nThank you for choosing Nyalix Global Care!`
}
