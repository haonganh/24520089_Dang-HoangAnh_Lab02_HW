
import { useState } from "react";

import CountdownTimer from "./components/CountdownTimer";
import FlashSaleInventory from "./components/FlashSaleInventory";

import "./App.css";

function App() {
  const [saleLive, setSaleLive] = useState(false);

  return (
    <div className="app">
      <header className="site-header">
        <div className="header-content">
          <span className="brand">
            FLASH SALE VN
          </span>

          <span className="sale-badge">
            11.11 MEGA SALE
          </span>
        </div>
      </header>

      <main className="main-content">
        {/* Hero */}
        <section
          className="hero"
          aria-labelledby="hero-title"
        >
          <p className="eyebrow">
            VIETNAM MEGA SALE
          </p>

          <h1 id="hero-title">
            High-Concurrency Flash Sale
          </h1>

          <p className="hero-description">
            Flash sale simulation with
            precision countdown,
            optimistic inventory reservation,
            and checkout state management.
          </p>
        </section>

        {/* Countdown */}
        <section
          className="countdown-section"
          aria-labelledby="countdown-title"
        >
          <h2 id="countdown-title">
            Flash Sale Countdown
          </h2>

          <CountdownTimer
            onSaleStateChange={setSaleLive}
          />
        </section>

        {/* Inventory */}
        <section
          className="products-section"
          aria-labelledby="products-title"
        >
          <h2 id="products-title">
            Flash Sale Products
          </h2>

          <FlashSaleInventory
            key={saleLive ? "live" : "waiting"}
            isSaleLive={saleLive}
          />
        </section>

        {/* Checkout */}
        <section
          className="checkout-section"
          aria-labelledby="checkout-title"
        >
          <h2 id="checkout-title">
            Checkout
          </h2>

          <p>
            Checkout confirmation, cancellation,
            and inventory rollback will be
            implemented in T06.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Web Application Development – Homework 3
        </p>

        <p>
          React + TypeScript | WCAG 2.2 AA Target
        </p>
      </footer>
    </div>
  );
}

export default App;
