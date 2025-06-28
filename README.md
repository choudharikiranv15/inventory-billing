
# 🧾 Inventory & Billing Management System

A full-stack web application to help small businesses automate inventory management and billing operations. Built with **React.js**, **Node.js**, and **MongoDB**, this system provides real-time inventory tracking, GST-compliant invoice generation, customer and vendor management, and secure authentication.

---

## 📌 Features

### ✅ Inventory Management
- Real-time stock tracking
- Low-stock alerts (planned)
- Barcode/QR code ready (extendable)

### ✅ Billing & Invoicing
- GST-compliant invoice generation (PDF)
- Add customer details (name, email, address)
- Automatically calculate invoice totals

### ✅ Customer & Vendor Management
- Add and manage customer records
- (Planned) Supplier purchase order automation

### ✅ Authentication
- JWT-based login and token management
- Role-based access (planned for Admin & Employee)

### ✅ Dashboard & Reports (Planned)
- Sales, expenses, and profits tracking
- Visual graphs for daily/weekly/monthly reports

---

## 🛠 Tech Stack

| Component   | Technology          |
|-------------|---------------------|
| Frontend    | React.js, Axios      |
| Backend     | Node.js, Express.js  |
| Database    | MongoDB, Mongoose    |
| Auth        | JWT (JSON Web Tokens)|
| Styling     | Inline CSS (customizable) |
| PDF         | Custom invoice generator using `pdfkit` or buffer-based utility |

---

## 🔐 Authentication Flow

- User logs in with username & password
- Backend issues a JWT token
- Token is stored in `localStorage`
- Token is used in headers for protected routes like `/api/products`, `/api/invoices/generate`

---

## 📂 Folder Structure

```
inventory-billing/
│
├── client/                  # React frontend
│   └── App.js               # Main UI logic
│
├── server/
│   ├── models/              # MongoDB models
│   ├── routes/              # Express routes
│   ├── utils/               # Invoice generator
│   ├── middleware/          # JWT auth middleware
│   └── server.js            # Express app entry point
│
├── README.md
└── package.json
```

---

## 🚀 How to Run the Project

### ⚙️ Backend (Node + Express)

1. Navigate to server folder:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Add a `.env` file:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection
   JWT_SECRET=your_secret_key
   ```

4. Start the server:
   ```bash
   npm start
   ```

---

### 🌐 Frontend (React)

1. Navigate to client folder:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

---

## 📄 Sample Invoice Screenshot

> Add a screenshot here:
```
📎 ![Invoice Sample](./screenshots/invoice_sample.png)
```

---

## 📊 Future Enhancements

- Add graphs and dashboard analytics
- Enable barcode scanning using ZXing
- Implement multi-location inventory sync
- Role-based access (Admin, Employee)
- Mobile responsive design

---

## 👨‍💻 Author

**Kiran Vijaykumar Choudhari**  
B.E. in AI & ML | MVJ College of Engineering  
📧 choudharikiranv15@gmail.com

---

## ⭐️ Show Your Support

If you found this project helpful, feel free to ⭐️ star the repository and share your feedback!
