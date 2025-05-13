# Inventory Billing System

A streamlined inventory and billing management application designed for small businesses to efficiently handle product inventories and generate invoices.

## 🚀 Features

- **Product Management**: Add, update, and delete products with ease.
- **Inventory Tracking**: Monitor stock levels to prevent shortages or overstocking.
- **Billing System**: Generate and manage customer invoices seamlessly.
- **User-Friendly Interface**: Intuitive design for easy navigation and operation.

## 🛠️ Technologies Used

- **Frontend**: React.js
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **ORM**: Sequelize

## 📦 Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/choudharikiranv15/inventory-billing.git
   cd inventory-billing
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:

   - Create a `.env` file in the root directory.
   - Refer to `.env.example` for the required environment variables.

4. **Initialize the database**:

   ```bash
   npm run init-db
   ```

5. **Start the application**:
   ```bash
   npm start
   ```

## 📁 Project Structure

```
inventory-billing/
├── src/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   └── app.js
├── db/
│   └── schema.sql
├── invoice-frontend/
├── .env.example
├── package.json
└── README.md
```
