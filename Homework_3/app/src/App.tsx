
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
            Flash sale simulation with precision
            countdown, inventory reservations,
            and checkout state management.
          </p>
        </section>

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
