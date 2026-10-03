# 🛍️ Deal Drop — Smart Price Tracker

**Deal Drop** is a modern full-stack price tracking web application that helps users monitor product prices across e-commerce platforms and discover price drops without manually checking product pages repeatedly.

🔗 **Live Demo:** https://price-drop-flax.vercel.app/

---

## 📌 About the Project

Deal Drop allows users to track products by simply providing their product URL. The application extracts important product information such as the **product name, image, current price, and other relevant details**, and stores the product for continuous price monitoring.

The application is designed to make online shopping more convenient by helping users identify price changes and potentially save money when a tracked product becomes cheaper.

Instead of repeatedly visiting an e-commerce website to check a product's price, users can add the product to Deal Drop and monitor its price history from one place.

---

## ✨ Features

* 🔗 **Product URL Tracking**
  Add products by providing their e-commerce product URL.

* 📉 **Price Monitoring**
  Track changes in product prices over time.

* 📊 **Price History**
  Monitor historical price changes to understand product pricing trends.

* 🔔 **Price Drop Notifications**
  Get notified when the price of a tracked product drops.

* 🛒 **Product Information Extraction**
  Automatically retrieve important product information from supported product pages.

* 👤 **User Authentication**
  Secure user authentication and personalized product tracking.

* 📱 **Responsive UI**
  Designed to work across desktop, tablet, and mobile devices.

* ⚡ **Modern Web Interface**
  Clean and interactive interface built with modern frontend technologies.

* ☁️ **Cloud Deployment**
  Deployed and hosted using Vercel.

---

## 🛠️ Tech Stack

### Frontend

* **Next.js**
* **React**
* **Tailwind CSS**
* **JavaScript**

### Backend & Database

* **Node.js**
* **Google Cloud**
* **PostgreSQL**

### Authentication

* **Clerk**
* **Google App Management**

### Deployment

* **Vercel**

### Other Technologies

* Web Scraping / Product Data Extraction
* REST APIs
* Price Monitoring
* Automated Notifications

---

## 🏗️ Application Workflow

```text
User
  │
  ▼
Enter Product URL
  │
  ▼
Deal Drop
  │
  ├── Extract Product Information
  │
  ├── Retrieve Current Price
  │
  └── Store Product Data
          │
          ▼
      Price Monitoring
          │
          ▼
     Price Changes
          │
          ▼
    Price Drop Alert
          │
          ▼
        User
```

---

## 🚀 Getting Started

Follow these steps to run the project locally.

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/your-repository.git
```

Navigate into the project directory:

```bash
cd your-repository
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Add your project environment variables here

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Add other required API/database variables
```

> ⚠️ Never commit your `.env.local` file or expose secret API keys publicly.

### 4. Start the Development Server

```bash
npm run dev
```

Open your browser and visit:

```text
http://localhost:3000
```

---

## 📂 Project Structure

```text
deal-drop/
│
├── app/
│   ├── page.js
│   ├── layout.js
│   └── ...
│
├── components/
│   └── ...
│
├── lib/
│   └── ...
│
├── public/
│   └── ...
│
├── .env.local
├── package.json
├── next.config.js
└── README.md
```

> The exact structure may vary depending on the current implementation.

---

## 🌐 Deployment

The project is deployed using **Vercel**.

### Production

🔗 https://price-drop-flax.vercel.app/

To deploy your own version:

1. Fork or clone this repository.
2. Push the project to GitHub.
3. Import the repository into Vercel.
4. Configure the required environment variables.
5. Deploy the project.

Vercel automatically creates a new deployment whenever changes are pushed to the configured GitHub branch.

---

## 🔐 Environment Variables

The application requires environment variables for services such as authentication, database access, and APIs.

Make sure the required variables are configured in:

```text
.env.local
```

for local development and in:

```text
Vercel → Project → Settings → Environment Variables
```

for production.

Never upload credentials or private API keys to GitHub.

---

## 📸 Project Highlights

### Product Tracking

Users can enter a product URL and add the product to their tracking list.

### Price Monitoring

Tracked products can be monitored for changes in their current price.

### Price History

Historical pricing data can be used to understand how a product's price changes over time.

### Personalized Tracking

Authenticated users can manage the products they want to monitor.

---

## 🎯 Project Goals

The main goals of Deal Drop are to:

* Simplify online price tracking.
* Reduce the need for repetitive manual price checking.
* Help users identify price drops.
* Provide useful price history information.
* Create a centralized product tracking experience.
* Demonstrate practical full-stack web development.

---

## 🔮 Future Improvements

Possible future enhancements include:

* 📈 Advanced price analytics
* 🤖 AI-powered deal recommendations
* 📧 Email notifications
* 📱 Push notifications
* 🛒 Support for additional e-commerce platforms
* 🎯 Custom target-price alerts
* 📊 More detailed price history charts
* 🔍 Product search and comparison
* 💡 Personalized deal recommendations

---

## 👨‍💻 Author

**Sachidananda Panigrahi**

Full-Stack Web Developer | Java | Spring Boot | Next.js | React

---

## 📄 License

This project is developed for educational and project purposes.

If you use or modify this project, please provide appropriate attribution to the original author.

---

⭐ **If you find this project useful, consider giving the repository a star!**
