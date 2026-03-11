# Admin Dashboard - Sidebar & Dynamic Categories Implementation

## Overview
Converted the horizontal tab navigation into a professional left vertical sidebar with dynamic category loading from the database.

## Key Changes

### 1. **Database Schema** 
**File:** `supabase/migrations/20260310_create_categories_table.sql`

- Created new `categories` table with:
  - `id`: UUID primary key
  - `name`: English category name
  - `name_ar`: Arabic category name
  - `description`: Category description
  - `icon`: Optional icon field for future UI enhancements
  - `order_index`: For sorting categories
  - Timestamps for tracking changes

- Inserted default categories:
  - Diagnostic / تشخيصي
  - Surgical / جراحي
  - ICU Equipment / معدات العناية المركزة
  - Laboratory / مختبري
  - Imaging / التصوير

- Added `category_id` foreign key column to products table for better relational data

### 2. **AdminSidebar Component**
**File:** `src/components/AdminSidebar.tsx`

Features:
- **Fixed left sidebar** with smooth animations
- **Icon-labeled menu items** for: Dashboard, Products, Orders, Certificates, Exhibitions, Messages, Newsletter, Users, Settings
- **Active item highlighting** with gradient gold background
- **Notification badges** showing real-time counts
- **Smooth hover effects** with scale and position animations
- **Mobile responsive** with slide-in/out animations
- **Responsive width**: 256px (250px + borders)
- **Professional styling** with Tailwind CSS and Framer Motion

```tsx
<AdminSidebar
  activeTab={tab}
  onTabChange={handleTabChange}
  notifications={{
    orders: newOrdersCount,
    messages: newMessagesCount,
    users: newUsersCount,
    newsletter: newNewsletterCount,
  }}
  isOpen={sidebarOpen}
  onClose={() => setSidebarOpen(false)}
/>
```

### 3. **Updated useCategories Hook**
**File:** `src/hooks/useCategories.ts`

Now provides three methods for category management:

**Primary Hook:**
```tsx
const { data: categories } = useCategories();
// Fetches from dedicated categories table with caching (5 min staleTime)
```

**Real-time Hook (used in Admin):**
```tsx
const { categories } = useCategoriesRealtime();
// Live updates when categories are added/updated/deleted in database
// Real-time Supabase subscriptions
```

**Legacy Hook (backward compatibility):**
```tsx
const { data: categories } = useCategoriesLegacy();
// Returns categories in { en, ar } format for existing code
```

### 4. **Admin Layout Restructuring**
**File:** `src/pages/Admin.tsx`

**Layout Changes:**
```
Before (Horizontal Tabs):
┌─────────────────────────────────┐
│  Admin Dashboard Header          │
├─────────────────────────────────┤
│ Tab | Tab | Tab | Tab | Tab ...  │
├─────────────────────────────────┤
│         Main Content             │
│                                   │
└─────────────────────────────────┘

After (Vertical Sidebar):
┌────────┬──────────────────────┐
│        │  Admin Dashboard     │
│ Menu   ├──────────────────────┤
│ Items  │                      │
│        │   Main Content       │
│        │                      │
│        │                      │
└────────┴──────────────────────┘
```

**Key Implementation Details:**
- Sidebar fixed on left (hidden on mobile, visible on desktop)
- Main content area uses `lg:ml-64` to adjust for sidebar
- Mobile menu toggle button in header
- Smooth sidebar animations with Framer Motion
- Notification counts integrated into sidebar badges (orders/messages/users/newsletter)
- Top‑bar summary now includes newsletter notifications as well

### 5. **Dynamic Product Categories**
**File:** `src/pages/Admin.tsx` (Product Form)

**Changes to Product Form:**
- Replaced hardcoded category text inputs with dynamic dropdown
- Categories auto-populate from database
- Arabic category name automatically populated when English is selected
- Arabic field disabled to prevent manual edits (synced from database)

```tsx
<select
  value={editProduct?.category ?? ''}
  onChange={(e) => {
    const selectedCategory = categories.find(c => c.name === e.target.value);
    setEditProduct((prev) => ({
      ...prev,
      category: e.target.value,
      category_ar: selectedCategory?.name_ar || ''
    }));
  }}
>
  <option value="">Select a category</option>
  {categories.map((cat) => (
    <option key={cat.id} value={cat.name}>{cat.name}</option>
  ))}
</select>
```

**Benefits:**
- ✅ No code edit required when adding new categories
- ✅ Automatic syncing of Arabic translations
- ✅ Real-time category availability
- ✅ Consistent category data across products

## Usage

### Adding New Categories
1. Go to Supabase dashboard
2. Insert record in `categories` table with:
   - `name`: English name
   - `name_ar`: Arabic translation
   - `order_index`: Display order
3. New category appears immediately in admin dashboard dropdowns

### Sidebar Navigation
- **Mobile**: Tap menu button to open/close sidebar
- **Desktop**: Sidebar always visible, takes 256px width
- **Active State**: Current tab highlighted in gold
- **Badges**: Red notification badges show counts

## Technical Stack
- **Frontend Framework**: React + TypeScript
- **Animation**: Framer Motion
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Supabase Realtime subscriptions
- **Icons**: Lucide React

## Responsive Design
- **Mobile** (< 1024px): Collapsible sidebar, full-width content
- **Desktop** (≥ 1024px): Fixed sidebar, content adjusts to remaining width
- **Smooth transitions** between modes

## Migration Steps
To deploy these changes:

1. Run Supabase migration:
   ```bash
   supabase migration up
   ```

2. Verify categories table is created with default categories

3. Test admin dashboard:
   - Sidebar appears on left
   - Categories dropdown populates correctly
   - Real-time updates when categories change
   - Mobile menu toggle works

## Performance Optimization
- **Lazy loading**: Categories cached for 5 minutes
- **Real-time sync**: Only fetches changes, not full refetch
- **Optimized rendering**: Sidebar uses memoization and animations
- **Database indexes**: Added on category_id for fast lookups

## Future Enhancements
- Category icons display in sidebar and dropdowns
- Category search filter in product form
- Drag-and-drop category reordering
- Category-specific product analytics
- Bulk category management UI

---

**Implementation Date:** March 10, 2026
**Version:** 1.0.0
**Status:** ✅ Complete and tested
