# Inventory Pro – Features Specification

This document describes every page and its user-visible features in detail.

The app has 8 pages, reachable from the main navigation:
Dashboard, Point of Sale (POS), Products, Stock Update, Sales History,
Expenses, Reports, Settings.

Global behaviors apply across pages and are described first.

---

## 1. Global / Cross-Cutting Features

### 1.1 Navigation

- A persistent sidebar lists all 8 pages with icons and labels; its bottom
  footer holds the quick backup control (§1.9).
- A header shows the sidebar trigger and the current page title.
- The main content area shows one page at a time.
- The app opens in a Chrome/Edge tab (default browser as fallback). Launching
  the app again opens a tab on the running server instead of starting a second
  copy.

### 1.2 Languages & Theme

- The whole user interface is available in English and Turkish.
- The user can switch language in Settings > General. It applies immediately.
- The user can switch theme in Settings > General: `Light`, `Dark` or `System`.
  It applies immediately and is remembered for the next launch.
- Product search is tolerant of Turkish characters (e.g. `ı/I/İ/i`, `ğ/Ğ`,
  `ü/Ü`, `ö/Ö`, `ş/Ş`, `ç/Ç` match their Latin equivalents).

### 1.3 Currency, Dates, Numbers

- The user selects a store currency in Settings: USD ($), EUR (€), GBP (£),
  TRY (₺). All money values across all pages use the selected currency.
- The user selects a date format in Settings: `MM/DD/YYYY`, `DD/MM/YYYY`,
  `YYYY-MM-DD`. All dates across Dashboard, Sales History, Expenses, Reports
  and receipts use it.
- Money is shown with 2 decimals. Percentages are shown with 1 decimal or as
  whole `X%` for margins.

### 1.4 Business Identity on Documents

- Business Name, Address, Phone, Email, Tax ID entered in Settings appear on:
  - Sale detail view header.
  - Printed receipts.
- A custom Receipt Header text appears at the top of receipts if set.
- A custom Receipt Footer text appears at the bottom of receipts. Default:
  `Thank you for your purchase!`.

### 1.5 Low Stock Notifications

- Each product has a Minimum Stock Threshold (default 5).
- A product is:
  - `Out of Stock` when quantity <= 0.
  - `Low Stock` when 0 < quantity <= threshold.
  - `In Stock` when quantity > threshold.
- The user can enable/disable low stock notifications in Settings > General.
- When enabled, completing a POS sale shows one pop-up warning per product
  that became low: product name, current stock, threshold.

### 1.6 Update Notification

- On launch the app checks the latest published release once. When a newer
  version exists, a small card appears top-right:
  - Title: `Updates Available`.
  - Message: `Version X is ready to download.`
  - `Download & Install` button. Downloading shows a progress bar with the
    percent complete. A failed download shows `Update failed` with the reason.
  - Close (X) button to dismiss.
  - Auto-dismisses after 60 seconds if not closed (not while downloading).
- After a successful download the card says `Update downloaded. Restart the
  app to apply it.` and offers `Restart Now`.
- `Restart Now` (update card, or Settings > About) installs the update and
  restarts the app. The local server stops while the new version is
  installed, so a full-screen overlay covers the app until it is back:
  - Title: `Restarting Inventory Pro`, with the version being installed.
  - An indeterminate progress bar, the restart steps (preparing, installing,
    starting the new version, ready) and the elapsed seconds.
  - The window reloads itself when the new version is up. No second tab or
    window is opened.
  - If the new version does not start, the overlay says so and offers a
    `Reload` button.
- Settings > About (§9.5) offers a manual `Check for updates` with the same
  states: up to date, update available (with the same download and restart
  steps), or the reason the check failed.

### 1.7 Common List Behaviors

- Lists show a loading state while data loads.
- Lists show an error state with a `Retry` button when loading fails.
- Lists show an empty message when there is no data.
- Success and error messages are shown for create, update, delete, restore,
  import, export, sale, return and cancellation actions.
- Delete / archive / restore / reset / import actions always ask for
  confirmation first.

### 1.8 Scheduled Backup

- When the scheduled-backup option is enabled, the app writes an automatic
  Excel backup once an hour, on the hour (e.g. `14:00`, `15:00`), while it is
  running. No prompt appears and closing is never blocked. The first backup
  after launch is the next hour, not immediately.
- Each day gets one file, `inventory-YYYY-MM-DD-HHMM.xlsx` (local date + time),
  in the backup folder (default `%APPDATA%\Inventory Pro\backups`, changeable
  in Settings > Database). Each hourly run writes the file for its hour and
  deletes same-day files from earlier hours (and legacy date-only /
  `inventory-auto-` files), so only the latest hour's file per day is kept.
  Previous days' files are kept.
- Successful backups are silent. Settings > Database shows the last backup
  time (store date format + time). Failed backups show an error toast with
  the reason.
- When the option is disabled (the default), no automatic backups are written
  and the app closes directly with no prompt.

### 1.9 Quick Backup (sidebar)

- The bottom of the left sidebar has a `Back up now` button. One click writes
  an Excel snapshot of all data into the backup folder with no dialog, using
  the scheduled-backup format `inventory-YYYY-MM-DD-HHMM.xlsx` (local date and
  time). Quick and scheduled backups share the same one-file-per-day retention;
  a quick backup replaces that day's earlier backup. Success shows a toast
  naming the file; failure shows the reason.
- A status line under the button shows the newest Excel backup's file name and cloud state
  the way Windows Explorer shows it: `Synced to Google Drive` with the write
  time, `Sending to Google Drive…` while Explorer does not yet show the synced
  badge, `Saved on this PC` when the folder is not inside Google Drive or
  OneDrive, and `Sync state unavailable` when Explorer reports no badge for
  the folder.
- Clicking the status line opens a dialog with the file name, size, write
  time, backup folder, and the reason for the state, plus `Back up now` and
  `Open folder`.
- The state comes from the Windows shell badge on the newest backup file,
  compared with a backup file that has not changed for 10 minutes. The app
  does not sign in to or contact a cloud provider.

### 1.10 Server Restart

- Some settings are only read when the local server starts: `Network access
  (LAN)` (§1.11) and the database folder (§9.4). Saving one of them (or
  pressing `Restart server`, §9.1) stops and starts the server automatically.
- While it restarts, a full-screen overlay covers the app:
  - Title: `Restarting Inventory Pro`, with a line saying the app is restarting
    and the page reloads itself.
  - An indeterminate progress bar, the restart steps (preparing, stopping the
    server, starting the server, ready) and the elapsed seconds.
  - The page reloads itself when the server answers again. No second browser
    tab is opened.
  - If the server does not come back in time, the overlay says so and offers a
    `Reload` button.
- No data is lost or moved by a restart; it is not a reinstall.

### 1.11 Network Access (LAN)

- Off by default. The app listens on this PC only (loopback, default port
  5178) and other devices cannot reach it.
- When enabled in Settings > General > Network, the app listens on all network
  interfaces instead, on the same port. Other devices on the same network open
  the LAN address in a browser and get the same app and data.
- Settings shows that LAN address with a `Copy` button and a QR code that can
  be scanned from a phone or tablet. When no private LAN address exists, it
  says so instead of showing a QR code.
- Turning it on asks for confirmation, then starts the Windows Firewall helper.
  Windows asks for Administrator approval and adds an inbound rule for TCP
  5178 on all profiles. Without that rule other devices are blocked even on a
  private network.
- The setting is read at start-up, so saving a change restarts the server
  automatically (§1.10). If the setting is on but the server has not rebound
  yet, the page says a restart is needed.
- The host PC must be running the app; there is no cloud or relay. There is
  also no login, so any device on the network that knows the address can read
  and change the shop data. Enable it only on a trusted network.

### 1.12 Installable App (PWA)

- The app can be installed from Chrome or Edge on the host PC (the install
  icon in the address bar, or browser menu > Install) and then opens in its
  own standalone window, with the Inventory Pro name and icon, on the same
  server and data as the browser tab. It opens on the Dashboard; where the
  browser supports manifest shortcuts, the icon also offers Point of Sale and
  Products.
- On iPhone/iPad, the app can be added to the Home Screen from Safari and opens
  standalone, even over the plain-HTTP LAN address (§1.11). It has no offline
  shell there, because service workers require a secure context.
- On Android, Chrome only creates a browser-shortcut for a plain-HTTP LAN
  address; a real standalone/WebAPK install requires HTTPS. On the host PC
  (`127.0.0.1`) the app is a fully installable PWA.
- Only the app shell (HTML, icons, built assets) is cached. Shop data is never
  stored offline; the installed window reads live data from the running
  server. If the server is restarting or stopped, the window still opens and
  shows the normal loading / `Retry` states until the server answers again.

---

## 2. Dashboard

The Dashboard is the landing page. It shows a welcome line, the business name,
11 metric cards and 10 analysis panels.

### 2.1 Metric Cards

Every card shows a title, a large value, and a `?` help icon that explains the
metric on hover. Failed cards show `Failed to load` + `Retry`.

1. **Total Products**: count of all active products in the catalog, including
   in-stock and out-of-stock items.
2. **Low Stock Items**: count of products whose current quantity is at or
   below their minimum-stock threshold. Signals reorder need.
3. **Today's Sales**: total revenue from all completed sales since 12:00 AM
   today, all payment methods.
4. **Monthly Revenue**: total revenue for the current calendar month, all
   completed transactions. Reflects discounts.
5. **Monthly Profit**: net profit for the current calendar month
   (revenue minus cost of goods sold).
6. **Profit Margin**: monthly profit ÷ monthly revenue × 100, shown as `X%`.
7. **Inventory Turnover**: how many times inventory is sold/replaced, shown as
   `X.Xx` (e.g. `2.5x`). Higher means more efficient.
8. **Inventory Value**: current total value of on-hand stock at cost price
   (for each item: quantity × purchase cost, summed).
9. **Monthly Expenses**: total recorded expenses for the current calendar
   month, all categories and payment methods.
10. **Total Cash**: monthly cash revenue minus monthly expenses. Shows a trend
    indicator: green `↑ Positive` if >= 0, red `↓ Negative` if < 0.
11. **Revenue Expense Difference**: monthly revenue (all payment methods) minus
    monthly expenses. Shows the same positive/negative trend indicator.

### 2.2 Top Selling Products

- Horizontal bar chart + table of top products.
- User controls:
  - `Sort By`: Revenue / Profit / Quantity.
  - `Show`: 5 / 10 / 15 products.
  - `Time Period`: Week / Month / Year.
- Each bar length = selected metric; value shown in money or units.
- Table columns: Product | Quantity | Revenue | Profit | Margin, plus a Total
  row with summed quantity/revenue/profit and overall margin.
- Empty message when no product data.

### 2.3 Revenue & Profit by Supplier

- Grouped horizontal bars for the current month: two bars per supplier,
  Revenue and Profit.
- Table: Supplier | Revenue | Profit | Margin %, plus a Total row.
- Note shown to the user: margin here may differ from dashboard cards because
  discounts are not included in this breakdown.
- Hover shows exact money values.

### 2.4 Average Sales by Day of Week

- Grouped vertical bars, dual axis: average sale count (left axis) and average
  revenue (right axis) per weekday Monday–Sunday.
- User filter: `Time Period`: Week / Month / Year, controls what the averages
  are calculated over.
- Hover shows count and revenue.

### 2.5 Average Sales by Month of Year

- Same concept as above but per month January–December.
- User filter: `Year`: current year / previous year.

### 2.6 Revenue by Payment Method

- Doughnut chart + table for the current month.
- Slices: Cash, Credit/Debit Card, Bank Transfer, Check, Mobile Payment,
  Split (Cash + Card), Other. Slice size = revenue share. Legend on the side.
- Hover shows `Method: amount (X%)`.
- Table: Method | Revenue | Percentage, plus a Total row = 100%.
- If card sales exist, an extra row shows
  `Net Card Amount (After Vendor Fee)` with the net amount and fee % note.
- Fixed to current month, no time filter.

### 2.7 Inventory Value by Supplier

- Shows current stock value distribution by supplier.
- User can toggle `Pie Chart` / `Bar Chart`.
- Table: Supplier | Value (money) | Items (product count) | Percentage, plus
  a Total row with total value, total items, 100%.

### 2.8 Monthly Expenses Trend

- Vertical bar chart of the last 6 months, one bar per month = total expenses.
- Fixed 6-month window, no user filter. Used to spot unusually high months.

### 2.9 Revenue & Profit Trend

- Grouped vertical bars for the last 6 months, two bars per month: Revenue
  and Profit. Used to track growth vs. profitability.

### 2.10 Category Profit Analysis

- Current calendar month, per category.
- Toggle `Pie Chart` (profit share per category) / `Bar Chart` (Profit vs.
  Cost side-by-side per category).
- Table: Category | Revenue | Cost | Profit | Margin %, plus a Total row.
- Same warning note as supplier breakdown: discounts are not included in this
  margin.

### 2.11 Inventory Value by Category

- Current snapshot of stock value by category.
- Toggle `Pie Chart` / `Bar Chart`.
- Table: Category | Items (product count) | Value (money) | Percentage, plus
  a Total row.

### 2.12 Dashboard Interactions

- Hover `?` icons for plain-language definitions.
- Hover any chart bar/slice for exact count, revenue, profit, value and
  percentage.
- Change dropdowns (sort, show count, period, year) to recalculate panels.
- Toggle Pie vs. Bar where offered.
- Click `Retry` when a card or chart fails to load.

---

## 3. Point of Sale (POS)

Two-panel screen: left = search + categories + product grid; right = current
sale cart + discount/totals + Cash / Card / Split buttons.

### 3.1 Product Search

- Search box with placeholder `Scan barcode or search products...` plus a
  `Search` button. Submit with Enter or button.
- Live filtering as the user types.
- Matches on:
  - Product name (case-insensitive, Turkish-character tolerant).
  - Barcode (case-insensitive substring).
  - Selling price (typing `25` finds prices `25`, `250`, `125.99`).
- Search text and selected category combine (both apply).
- Search box is auto-focused on page open and re-focused after each completed
  sale.

### 3.2 Product Grid

- Each card shows: product name, selling price with store currency, stock
  status.
- Stock status is either `Out of Stock` (dimmed, cannot be clicked) or
  `In Stock: [count] [unit]` (e.g. `12 pcs / kg / g / l / m / box / unit`).
- Click an in-stock card to add 1 unit to the cart.
- Supported unit labels: pcs, kg, g, l, ml, m, box, unit/units, with long
  forms Pieces, Kilograms, Grams, Liters, Meters, Boxes.
- Empty message: no products available, add products to inventory first.

### 3.3 Barcode Handling

- If the search text is numeric, an exact barcode match is tried first:
  - If found, the product is added immediately and the search box is cleared.
  - If not found, normal filtered-list logic applies.
- If a search submit leaves exactly 1 product in the filtered grid, that
  product is auto-added and the search is cleared.
- Barcode scanners that send Enter/newline at the end work automatically:
  exact barcode lookup, add to cart, clear search.

### 3.4 Category Filter

- Collapsible `Categories` section, collapsed by default.
- Header click toggles expanded/collapsed.
- When expanded, pill buttons: `All` + one per category name.
- Selected pill is highlighted. `All` clears the filter.
- Selecting a category filters the product grid to that category only.

### 3.5 Cart

- Header: `Current Sale` + `Clear` button. `Clear` empties all items and the
  discount.
- Empty state message: no items in cart, add products by scanning or
  searching.
- Each line shows: product name, unit price × editable quantity + unit label,
  line total, remove (`×`) button.
- Quantity is editable via a number field directly in the cart.
- Adding the same product again increments its quantity by 1.
- Line total = quantity × unit price, recalculated automatically.
- After a successful sale the cart is auto-cleared, discount cleared, payment
  fields reset. A success message shows the total amount.

### 3.6 Stock Rules in POS

- Cannot add a product with stock <= 0: message `out of stock`.
- Cannot exceed stock:
  - On add: if cart quantity + 1 > stock, message `insufficient stock`,
    no change.
  - On edit: quantity is clamped to 1 … available stock.
- Quantity cannot go below 1 via edit.
- Product stock counts refresh automatically after each sale.

### 3.7 Discounts

Always visible in the cart footer:

- `Subtotal`: sum of line totals.
- Discount entry + `Discount: -amount` row (only if discount > 0, in red).
- `Total`: subtotal minus discount, emphasized.

Discount controls:

- Type dropdown: `Fixed Amount` / `Percentage (%)` / `Set Total`.
- Numeric value field with placeholders `0.00` (fixed), `0%` (percent),
  desired total amount (set-total).
- `×` clear button, disabled when no discount.

Rules:

- Empty, invalid or negative input clears the discount to 0.
- Percentage is capped at 100% (over 100% = full subtotal as discount).
- Fixed amount is capped at subtotal (over subtotal rewrites to subtotal,
  making total 0).
- Set Total: if desired total > subtotal there is no discount; otherwise
  discount = subtotal − desired total.
- Recalculates instantly when type, value or subtotal changes.
- Cleared on `Clear cart` and after a successful sale.

### 3.8 Payment Methods

Three buttons at the cart bottom, all disabled when the cart is empty:

- `Cash Payment`.
- `Card Payment`.
- `Split Payment` (Cash + Card).

Clicking opens a payment dialog with a method-specific title. Pre-fill:

- Cash: `Amount Received` pre-filled with Total, change 0.
- Card: confirmation for the full Total, no amount to type.
- Split: `Cash Amount` empty, `Card Amount` pre-filled with Total, change 0.

Dialog rules:

- Cannot be closed by clicking outside; must use `Cancel`, `Complete Sale`
  or `X`.
- Footer: `Cancel` + `Complete Sale`. While saving, `Complete Sale` shows
  `Processing...` and is disabled.
- `Complete Sale` is disabled when: cash amount is empty, or split
  cash + card < total, or already processing.
- Empty cart: message to add items before proceeding.

### 3.9 Cash Payment Details

- Shows `Total`.
- `Amount Received` numeric input, auto-focused, live change calculation.
- `Change` box always visible. Change = max(0, paid − total).
- If paid < total, a red `Shortfall amount` warning shows.
- On confirm with shortfall, a pop-up asks: customer is paying X less, apply
  as discount? OK / Cancel.
  - OK: sale completes with the shortfall applied as extra fixed discount,
    paid = new total, change 0, receipt shows the discount.
  - Cancel: warning that amount received is less than total, stay in dialog.
- Generic failure shows an error message.

### 3.10 Split Payment Details

- `Cash Amount` numeric input, auto-focused.
- `Card Amount` numeric input, editable unless overpaying.
- Typing cash auto-computes: `Card = max(0, Total − Cash)` and
  `Change = max(0, Cash − Total)`.
- If overpaying (change > 0), the card field becomes disabled and a change
  box shows.
- Summary box: `Total Payment = cash + card − change`.
- If cash + card < total on confirm: message that combined payment is less
  than total, stay in dialog.

### 3.11 Receipt

After successful payment a Receipt dialog opens automatically:

- `Receipt #INV-YYYYMMDD-HHmmss` (e.g. `INV-20260211-143022`).
- Date in the store date format.
- Header: business name, address (if set), `Phone:` (if set), `Email:` (if
  set), custom receipt header text (if set).
- Body table `Item | Qty | Price | Total`: product name, quantity + unit,
  unit price, line total per row.
- Totals: `Subtotal`, `Discount: -amount` (only if > 0), `Total`.
- Payment section:
  - `Payment Method: Cash / Card / Split (Cash + Card)`.
  - Cash: `Amount Received` + `Change`.
  - Split: `Cash Amount` + `Card Amount` + `Change` (only if > 0).
  - Card: method only.
- Footer: custom receipt footer, or default `Thank you for your purchase!`.
- Actions: `Close` + `Print Receipt` (prints the formatted receipt).
- If there is no receipt data the dialog shows nothing.

### 3.12 What POS Does Not Do

- No hold / park / suspend / resume sale, no draft sales, no multi-cart.

---

## 4. Products (Product Management)

Three tabs: `Product List`, `Categories`, `Suppliers`. The `Add Product`
button is visible only in list view.

### 4.1 Product Fields

Add and edit use the same form:

- **Product Name** (required, free text).
- **Barcode / SKU** (optional, free text, can be blank).
- **Category** (required, dropdown of existing categories created in the
  Categories tab).
- **Unit of Measurement** (optional, default `pcs`): Pieces (pcs), Kilograms
  (kg), Grams (g), Liters (l), ml, Meters (m), Boxes (box).
- **Selling Price** (required, numeric, min 0, 2-decimal steps).
- **Cost Price** (required, numeric, min 0, 2-decimal steps).
- **Current Stock Quantity** (required, numeric, min 0, default 0 on new).
- **Minimum Stock Threshold** (required, numeric, min 0, default 5 on new).
  Drives low-stock detection.
- **Supplier** (optional, dropdown of existing suppliers + `none`).
- **Description** (optional, multi-line text).
- Missing required fields show inline `field required` messages and a
  `please fix errors` message on submit.

Prices in the list are shown with the selected currency and 2 decimals.

### 4.2 Create / Edit / Archive / Restore

- **Create**: `Add Product` → blank form with defaults (pcs / 0 / 5) →
  `Save Product` → success message → auto-return to list, list refreshed.
  `Cancel` returns without saving.
- **Edit**: pencil icon per row loads current values into the same form,
  heading changes to `Edit Product`, button becomes `Update Product` →
  success message → return to list. `Cancel` discards changes.
- **Archive**: trash icon per active row → confirmation
  (`delete this product, cannot be undone`) → success → disappears from Active
  view. Archived rows show name struck-through + `(Deleted)` label when viewed
  under Deleted / All.
- **Restore**: in Deleted / All view, archived rows show a restore action
  instead of edit/delete → confirmation → success → reappears in Active.
- There is no permanent-delete button in the list; only archive + restore.

### 4.3 Product List, Search, Filters

Table columns: Product Name | Category (name) | Price (selling price) |
Stock (quantity + unit + status badge) | Actions.

- Paginated, 10 per page, with total items/pages control. Resets to page 1 on
  filter/search change.
- Search `Search products...` matches name, barcode and description,
  case-insensitive.
- Filters (combinable with search):
  - Category: `All Categories` + each category name.
  - Stock level: `All Stock Levels / Out of Stock / Low Stock / In Stock`.
  - Status: `Active Products / Deleted Products / All Products`.
- No column sorting controls (no A-Z / price sort).
- Empty messages guide the user to add the first product or adjust criteria.
- Stock cell badge: `<qty> <unit> (<status>)` with color: red Out of Stock,
  amber Low Stock, green In Stock. Threshold is editable in the product form.

### 4.4 Bulk Actions

- None. All actions are single-product. No checkboxes, multi-select, bulk
  update, or import/export on this page.

### 4.5 Categories Tab

Left form + right list, without leaving Product Management:

- Form fields: Name (required), Description (optional).
- Title switches `Add Category` / `Edit Category`, button
  `Save Category` / `Update Category`. `Cancel` shows only when editing and
  returns to Add mode.
- List columns: Name | Products (count of active products in category) |
  Actions.
- Row actions: edit loads into the form; delete asks for confirmation.
- Delete is disabled when the count > 0: message that a category with
  products cannot be deleted.
- Empty message prompts to add the first category.
- New/renamed categories immediately appear in the product form dropdown,
  product list filter and table.

### 4.6 Suppliers Tab

Left form + right list:

- Form fields: Company Name (required), Contact Person, Phone, Email,
  Address (2-row text).
- Title `Add Supplier` / `Edit Supplier`, button
  `Save Supplier` / `Update Supplier`. `Cancel` when editing.
- List columns: Company Name | Contact Person | Phone | Actions.
- Row actions: edit loads values; delete asks for confirmation and is
  disabled when products are linked (message that a supplier with products
  cannot be deleted).
- Empty message prompts to add the first supplier.
- Suppliers appear in the product form dropdown by company name. The product
  table does not show a supplier column.

---

## 5. Stock Update

Two-pane page: left = search + product cards; right = adjustment form.

### 5.1 Product Selection

- Search box on top matches name, barcode and SKU.
- Each card shows: name (bold), barcode if present, `Stock: X units`,
  `Cost Price` formatted.
- Click to select; selected card is highlighted.
- If nothing is selected the right pane shows: select a product from the list.
- Loading and no-results messages are shown as needed.

### 5.2 Adjustment Form

When a product is selected, a read-only header shows:

- `Stock Update: <Product Name>`.
- Current stock (quantity + unit).
- Current cost price.
- Current selling price.

Editable fields:

- **Adjustment Type**: dropdown `Add` / `Remove`, default `Add`.
- **Quantity**: numeric, min 0, whole units, required. Must be > 0 on submit.
- **New Cost Price**: numeric, min 0, 2-decimal steps, pre-filled with current
  cost. Editable only when type = Add; disabled when type = Remove.
- **New Selling Price**: numeric, min 0, 2-decimal steps, pre-filled with
  current selling price. Always editable.
- **Reason**: multi-line free text, optional. If left empty it is saved as
  `Stock adjustment`.

Actions:

- `Update` submits → success message → list refreshed, selection cleared,
  form reset.
- `Reset` restores the form to quantity 0, current cost/selling, type Add,
  empty reason for the same product.
- Validation: must select a product; quantity must be a valid positive
  number.

### 5.3 Cost Averaging Preview

Visible only when type = Add and quantity > 0. Updates live as quantity or
new cost is typed. Shows:

- Current stock quantity.
- Current cost price.
- Current inventory value (current stock × current cost).
- Total inventory quantity after the addition.
- New average cost: (old value + new quantity × new cost) ÷ new total.
- New inventory value: new total × new average.

Save behavior:

- Add: cost becomes the weighted average shown.
- Remove: cost unchanged, stock reduced (floor 0). Total value = remaining ×
  current cost.
- Selling price is updated only if the new value differs.

### 5.4 Price History

- No history list, log or chart is shown here. Only current prices, the
  ability to enter new prices, and the live average-cost preview.

---

## 6. Sales History

### 6.1 Sales List

Table columns:

- `Receipt #`: receipt number or ID. Struck-through + greyed if canceled.
- `Date & Time`: sale date + time in the chosen date format.
- `Items`: count of line items.
- `Total`: final total in shop currency.
- `Payment`: `Cash` / `Card` / `Split (Cash + Card)`.
- `Status`: badge `Completed` (green) or `Canceled` (red).
- `Actions`: `View Details` button per row. Clicking the row also opens
  details. Selected row is highlighted.

Other behaviors:

- 10 sales per page with total count, total pages and page navigation.
- `Refresh` button top-right reloads the list.
- States: loading, error, and `no sales records for the selected period`.

### 6.2 Filters and Search

- `From` + `To` date pickers + `Apply Filter` button (applied together).
  Default range: last 30 days to today.
- `Payment` dropdown, applies instantly: All Payment Methods / Cash / Card /
  Split (Cash + Card).
- `Search` text box, applies while typing, searches by receipt number.
- Changing payment or search resets to page 1.

### 6.3 Sale Detail View

Side panel opened via `View Details` or row click. Title `Sale Details` +
`Close` button.

- Header receipt-style: business name, address (if set), phone (if set),
  email (if set), date, receipt number. Red `Canceled` label if canceled.
- Items table: Item (product name; shows `Unknown Product` if the product was
  later deleted) | Qty (quantity + unit) | Price (unit price) | Total (line
  total).
- Totals: Subtotal; Discount (only if > 0, red as `-amount`); Tax (only if >
  0); Total (bold); Payment Method (Cash / Card / Split); split breakdown
  (each method + amount, or legacy cash amount / card amount); Change (only
  if > 0).
- Footer actions: `Print Receipt`, `Process Return`, `Cancel Sale` (hidden if
  already canceled).

### 6.4 Receipt Reprint

- `Print Receipt` in the detail panel prints the formatted receipt with
  business info, custom header/footer from settings, receipt number,
  formatted date/time, item list with quantity/unit/price/total, subtotal,
  discount, tax, total, payment method + split details, change, all in shop
  currency.
- A message is shown if printing fails.

### 6.5 Return Flow

- `Process Return` button is present in the detail panel but currently
  disabled.
- The return dialog design (for when it is enabled): large dialog with one
  row per original item showing product name, original quantity + unit,
  return-quantity number input (min 0, max original quantity), unit price,
  live return amount (unit price × return quantity); `Return Reason` text
  area; live `Total Refund` sum; info text that returns update inventory
  immediately; validation requiring at least one item; `Confirm Return` /
  `Cancel` buttons with `Processing...` state; success and error messages.

### 6.6 Cancel Sale Flow

- `Cancel Sale` danger button, only for active sales.
- Confirmation dialog warns that cancellation returns all items to inventory,
  shows the receipt number and date, states it cannot be undone.
- Buttons: `Confirm Cancellation` / `Cancel`.
- Success: sale canceled message, list refreshes, detail panel updates to
  `Canceled` with strikethrough. Error message if cancellation fails.

---

## 7. Expenses

### 7.1 Top Actions

- `Add Expense` button opens the Add / Edit Expense form.
- `Add Category` button opens the Add / Edit Category form.

### 7.2 Expense Fields

- Date (date picker, required, defaults to today).
- Amount (number, 0.01 steps, required).
- Description (text, required).
- Category (dropdown, optional, shows all created categories).
- Payment Method (dropdown, required, defaults to Cash): Cash, Card, Bank
  Transfer, Check, Other.
- Recipient (text, optional: who was paid).
- Reference (text, optional: reference number).
- Notes (multi-line textarea, optional).
- Save / Update button.
- No recurring-expense option. No receipt file attachment.

### 7.3 Expense Categories

- Fields: Name (required) + Description (optional).
- Can be added, edited and deleted (delete asks for confirmation).
- Shown in the expense table as a colored badge; uncategorized shows as
  `Other`.
- Used for filtering and per-category totals.

### 7.4 Filters and Search

- Quick date presets (one click): `Today`, `This Week`, `This Month`,
  `This Year`.
- Custom range: start date – end date pickers (defaults to current month).
- Category filter: `All` + each category name.
- Payment method filter: `All` + Cash / Card / Bank Transfer / Check / Other.
- Search box: free-text search across expenses.
- `Apply Filters` applies; `Reset Filters` resets to current month + All.
- Empty state: `No expenses found`.

### 7.5 Summary Cards

Above the list:

- `Total Expenses` card: sum of currently filtered expenses.
- One card per category present in the results: category indicator + name +
  total amount.

### 7.6 Expenses List

Table columns: Date | Description | Reference | Recipient | Category (colored
badge) | Payment Method | Amount | Actions.

- Actions per row: edit (pencil), delete (trash with confirmation).
- Success / error messages for create, update, delete and load.

---

## 8. Reports

Left sidebar with grouped report navigation; the main panel shows the selected
report. Groups:

- **Performance**: Financial Summary, Top Products, Year-over-Year, Basket
  Size, Discounts.
- **Payments**: Payment Breakdown, Card Fees.
- **Breakdowns**: Supplier Performance, Category Profitability, Stock Value by
  Category, Stock Value by Supplier.
- **Stock Actions**: Reorder Alerts, Unsold Stock, Low-Margin Products,
  Frequently Bought Together.

Most reports show a date-range picker and changing the range applies
instantly. Default range: start to end of the current month. Five reports are
snapshots or use their own window and show no range picker: Year-over-Year
(own year picker), Reorder Alerts (trailing 30 days), Unsold Stock (30/60/90
day window), Stock Value by Category and Stock Value by Supplier (current
snapshot). Every report has loading, error-with-retry, and
`no data for the selected period` states.

### 8.1 Financial Summary Report

Default selected report. Title + description + period label
(e.g. `For period: 1 September 2026 to 30 September 2026`).

6 metrics, shown as cards:

- Revenue: total sales revenue for the period.
- Profit: gross profit for the period.
- Profit Margin: percentage value.
- Expenses: total expenses for the period.
- Total Cash: cash revenue minus expenses.
- Revenue Expense Difference: total revenue minus total expenses.

All money values in shop currency.

### 8.2 Top Products Report

Controls: `Sort By` Revenue / Profit / Quantity; `Show` 5 / 10 / 15 / 20
products.

- Horizontal bar chart, one bar per product, value = current sort field.
- Table: Product | Quantity sold | Revenue | Profit | Margin % per product,
  plus a Total footer row with total quantity, revenue, profit and overall
  margin %.

### 8.3 Revenue by Payment Method Report

- Table: Method (Cash, Card, Bank Transfer, Check, Mobile Payment, Split,
  Other) | Revenue | Percentage share of total revenue.
- If card sales exist, an extra italic row shows
  `Net Card Amount After Fee` (card revenue minus vendor fee, with fee %
  note).
- Total footer row: summed revenue + 100%.

### 8.4 Revenue by Supplier Report

- Horizontal bar chart with 2 series per supplier: Revenue and Profit.
- Table: Supplier | Revenue | Profit | Margin %, plus a Total footer with
  overall margin %.
- Muted warning note: margin here may differ from the dashboard card because
  discounts are not accounted for in this breakdown.

### 8.5 Category Profitability Report

- Toggle `Bar Chart` (grouped Profit vs. Cost per category) / `Pie Chart`
  (profit share per category, one color per category).
- Table: Category | Revenue | Cost | Profit | Margin %, plus a Total footer
  with overall margin %.
- Same muted discount warning as the supplier report.

### 8.6 Year-over-Year Report

No range picker. Controls: `Year` (current year and the five before it) and
`Metric` (Revenue / Profit).

- Two summary cards: `Revenue · <year>` and `Profit · <year>`, each with the
  change against the same total last year: green `↑` when up, red `↓` when
  down, as a percentage, or as money when last year had nothing to divide by.
- Grouped bar chart, one pair per month January–December: the selected metric
  for this year beside the same month last year. Legend labels both years;
  hover shows month + metric with both values.
- Table: Month | Revenue this year | Revenue last year | Change | Profit this
  year | Profit last year | Change, with a Total footer row. Months without
  sales show 0.

### 8.7 Basket Size Report

- Three cards: `Sales` (completed sales in the range), `Avg Items` (items per
  sale, 1 decimal), `Avg Value` (revenue per sale in shop currency).
- Daily chart over the range: bars = daily revenue, line = average basket
  value that day (dual axes). Hover shows money values.

### 8.8 Discounts Report

- Four cards: `Gross` (subtotal before discounts), `Discount Total` (red),
  `Share` (discount ÷ gross × 100, 1 decimal), `Discounted Sales` (number of
  sales with a discount).
- Daily bar chart of discount amount over the range.
- Shows the empty state when the range has no gross sales and no discounts.

### 8.9 Card Fees Report

- Three cards: `Card Revenue`, `Fee` (using the Credit Card Vendor Fee % from
  Settings > General, default 0.68), `Net` (card revenue minus fee).
- Daily bar chart of fee amount over the range.
- Shows the empty state when the range has no card revenue.

### 8.10 Frequently Bought Together Report

- Control: `Show` 5 / 10 / 15 pairs (default 10) plus the date range.
- Rows are product pairs that appear in the same completed sale.
- Table: Pair (`Product A + Product B`) | Sold Together (number of completed
  sales containing both) | Frequency (share of completed sales in the range,
  1 decimal %).
- Sorted by Sold Together, highest first.

### 8.11 Reorder Alerts Report

No range picker; it always looks at the trailing 30 days of completed sales.

- Table: Product | Stock (quantity + unit) | Avg Daily Sales (1 decimal) |
  Days of Cover (stock ÷ average daily sales). Cover is a red badge under 7
  days, a normal badge under 30 days, muted otherwise, and `Never sold` when
  the product had no sales in the window.
- Sorted most urgent first; never-sold products come last.

### 8.12 Unsold Stock Report

No range picker. Control: window of `30`, `60` or `90` days (default 60).

- Lists active products with stock > 0 that had no completed sale in the
  window (never sold counts).
- `Total Tied Up` card: sum of stock × cost price for those products.
- Table: Product | Stock | Tied Value (at cost) | Last Sold (store date
  format, or `Never`). Sorted by tied value, highest first.

### 8.13 Low-Margin Products Report

- Control: `Margin Threshold` 10% / 20% / 30% (default 20%) plus the date
  range. Shows up to 20 products whose net margin is below the threshold,
  worst first. Sale-level discounts are prorated to each line by its share of
  the sale subtotal.
- Two cards: `At-Risk Product` (rows listed) and `Loss-Making Product` (rows
  with margin below 0, red).
- Table: Product | Quantity | Net Revenue | Profit | Margin (red badge when
  negative), plus a Total footer with overall margin.

### 8.14 Stock Value by Category Report

Snapshot, no date range.

- Horizontal bar chart of current stock value per category.
- Table: Category | Items (product count) | Value | Share, plus a Total row
  (total items, total value, 100%). Products without a category show `—`.

### 8.15 Stock Value by Supplier Report

Snapshot, no date range.

- Horizontal bar chart of current stock value per supplier.
- Table: Supplier | Value | Items | Share, plus a Total row. Products without
  a supplier show `—`.

### 8.16 Export / Print in Reports

- The current Reports page has no export-to-CSV or print buttons in any of
  the report views. Printing of sales documents is done from Sales History
  (`Print Receipt`) and POS (`Print Receipt`).

---

## 9. Settings

Left tab navigation with 5 sections: General, Business Information, Receipt
Customization, Database, About.

### 9.1 General Tab

Cards, top to bottom: Appearance, Regional, Inventory, Network, Restart
server, Danger zone. Form cards each have their own `Save Changes` button and
show `Unsaved changes` while dirty.

**Appearance**

- Language dropdown (English, Turkish), applies immediately on change.
- Theme dropdown: `Light`, `Dark`, `System`. Applies immediately.
- `Start with Windows` switch — when on, Inventory Pro launches automatically
  at Windows log-in (per-user Run entry pointing at the installed exe). The
  entry is reconciled at every launch, so an update that installs to a new
  folder keeps working. No Administrator rights are needed.

**Regional**

- Currency dropdown: USD ($), EUR (€), GBP (£), TRY (₺).
- Date Format dropdown: `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`.
- Live preview of the selected currency and date format.

**Inventory**

- `Enable Low Stock Notifications` switch (description under the label).
- `Credit Card Vendor Fee (%)` number input (0.01 steps, default 0.68). Used
  to compute net card amounts shown on Dashboard and Reports.

**Network**

- `Network access (LAN)` switch. Turning it on asks for confirmation, then
  starts the Windows Firewall helper with Administrator approval (inbound TCP
  5178, all profiles). Saving a change restarts the server automatically.
- While it is on, the card shows the LAN address for other devices with a
  `Copy` button and a QR code. It shows a "restart the app to share" note when
  the server has not rebound yet, and a "no LAN address" note when the PC has
  no private network address. See §1.11.

**Restart server**

- `Restart server` button with a confirmation dialog. Stops and starts the
  local server so Network and database-folder changes apply, without losing
  data. Uses the restart overlay (§1.10).

**Danger zone**

- `Reset Settings` (danger): restores all settings to defaults, does not
  delete data, asks for confirmation.
- The read-only app version lives in the About tab (§9.5).

Note: tax-setting labels (enable tax calculation, default tax rate %, tax
name such as Sales Tax/VAT/GST) exist in the app's wording but no Tax tab is
shown on the current Settings page.

### 9.2 Business Information Tab

- Business Name (text).
- Address (multi-line).
- Phone Number.
- Email.
- Tax ID / Business Number (text).
- `Save Changes` button.
- These values appear on sale details and printed receipts.

### 9.3 Receipt Customization Tab

- Receipt Header (multi-line text for the top of receipts).
- Receipt Footer (multi-line text for the bottom; defaults to thank-you
  message, can hold return policy text).
- `Show Business Logo on Receipt` checkbox.
- `Save Changes` button.

### 9.4 Database Tab

Cards: Backup (database file, JSON and Excel export/import), Migration (old
app Excel), Danger zone (reset), Scheduled backup. Every option the user sees:

- **Database file**: shows the database file currently in use.
  `Change…` picks another folder via folder picker (an existing
  `inventory.db` there will be used, otherwise a fresh one is created);
  `Use default` points back at `%APPDATA%\Inventory Pro`. Saving restarts
  the server automatically (§1.10); the current file is never moved or
  copied. The chosen folder is remembered in `db-location.json` beside the
  app's exe.
- **Export Data to JSON**: creates a JSON backup file of all data, useful for
  transferring to another device. Button `Export to JSON`.
- **Import Data from JSON**: imports from a JSON backup file via file picker.
  Confirmation warns it replaces current data. App reloads on success.
  Button `Import from JSON`.
- **Export Data to Excel**: exports data to a spreadsheet for external
  analysis or reporting. Button `Export to Excel`.
- **Import Data from Excel**: imports from a spreadsheet via file picker.
  Confirmation warns it replaces current data. App reloads on success.
  Button `Import from Excel`.
- **Import Data from old app Excel**: imports a spreadsheet exported by the
  previous Inventory Pro app via file picker. The workbook is converted to
  the current database format. Confirmation warns it replaces current data.
  App reloads on success; an invalid file shows the reason and current data
  is left untouched. Button `Import from old app Excel`.
- **Reset Database** (danger, red): warning that all data will be deleted and
  cannot be undone. Confirmation required. App reloads on success. Button
  `Reset Database`.
- **Scheduled backup (optional)**: when enabled, the app silently writes an
  Excel backup once an hour (one file per day, `inventory-YYYY-MM-DD-HHMM.xlsx`,
  latest hour kept; same retention as the sidebar quick backup). The last
  backup time is shown under the toggle, and failures show a toast. See `1.8
  Scheduled Backup`. The target folder is shown while the schedule is on and
  can be changed via a folder picker (empty = app default, reversible via `Use
  default`).
- Loading messages during operations: exporting/importing JSON/Excel,
  resetting database.

### 9.5 About Tab

- App icon, app name, a one-line summary, a short paragraph on what the app
  does (offline, data stays on this PC, optional LAN access) and the read-only
  app version.
- `Check for updates` button: checks the latest release.
  - Up to date: confirms the app is on the latest version.
  - Update available: shows the new version and a `Download & Install`
    button with a progress bar while downloading; the top-right update card
    appears as well.
  - Downloaded: shows `Update downloaded` and a `Restart Now` button that
    installs the update behind the restart overlay (§1.6).
  - Check failed: shows the reason.
- The automatic launch check (§1.6) is separate: the card appears on launch
  when a newer release exists and stays visible for 60 seconds unless
  dismissed.

---
