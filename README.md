# Food Advisor (F28WP Group 30)
Three web apps (customer, owner, admin) sharing one Node.js API and one MySQL database.

1. Start MySQL locally.
2. `npm install`
3. Set credentials if needed (defaults: root, empty password, database `food_advisor`):
   `DB_USER=root DB_PASSWORD=yourpass node server.js`
   Windows PowerShell: `$env:DB_PASSWORD="yourpass"; node server.js`

The database and tables are created from schema.sql on first start and seeded with demo data.

- Customer: http://localhost:3000/customer/  (customer / cust123)
- Owner:    http://localhost:3000/owner/     (owner / owner123)
- Admin:    http://localhost:3000/admin/     (admin / admin123)
