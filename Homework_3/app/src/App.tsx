
import { useState } from "react";

import CountdownTimer from "./components/CountdownTimer";
import FlashSaleInventory from "./components/FlashSaleInventory";

import "./App.css";

function App() {
  const [saleLive, setSaleLive] = useState(false);

  return (
    <div className="app">
      {/* Skip navigation for keyboard users */}
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      {/* Header */}
      <header className="site-header">
        <div className="header-content">
          <div className="brand-group">
            <span className="brand">FLASH SALE VN</span>
            <span className="brand-subtitle">
              Mega Shopping Festival
            </span>
          </div>

          <nav
            className="header-nav"
            aria-label="Main navigation"
          >
            <a href="#countdown-title">Countdown</a>
            <a href="#products-title">Products</a>
          </nav>

          <span className="sale-badge">
            11.11 MEGA SALE
          </span>
        </div>
      </header>

      <main id="main-content" className="main-content">
        {/* Hero */}
        <section
          className="hero"
          aria-labelledby="hero-title"
        >
          <span className="hero-badge">
            VIETNAM SHOPPING FESTIVAL
          </span>

          <h1 id="hero-title">
            High-Concurrency
            <span> Flash Sale</span>
          </h1>

          <p className="hero-description">
            Experience a realistic flash-sale simulation
            with precision countdown, optimistic
            inventory reservations, and secure
            checkout state management.
          </p>

          <div className="hero-features">
            <span>Precision Countdown</span>
            <span>Inventory Locking</span>
            <span>Checkout Simulation</span>
          </div>
        </section>

        {/* Countdown */}
        <section
          className="countdown-section"
          aria-labelledby="countdown-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-label">
                LIMITED TIME OFFER
              </span>

              <h2 id="countdown-title">
                Flash Sale Countdown
              </h2>
            </div>

            <span className="section-tag">
              {saleLive ? "SALE LIVE" : "COMING SOON"}
            </span>
          </div>

          <CountdownTimer
            onSaleStateChange={setSaleLive}
          />
        </section>

        {/* Product listing */}
        <section
          className="products-section"
          aria-labelledby="products-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-label">
                EXCLUSIVE DEAL
              </span>

              <h2 id="products-title">
                Flash Sale Products
              </h2>
            </div>

            <span className="section-tag">
              LIMITED STOCK
            </span>
          </div>

          <article
            className="product-card"
            aria-labelledby="product-name"
          >
            <div
              className="product-thumbnail"
              aria-hidden="true"
            >
              🎧
            </div>

            <div className="product-details">
              <span className="product-label">
                DEMO PRODUCT
              </span>

              <h3 id="product-name">
                Premium Wireless Headphones
              </h3>

              <p className="product-description">
                High-quality wireless headphones
                featured in the Vietnam Mega Sale
                simulation.
              </p>

              <div className="product-pricing">
                <strong className="sale-price">
                  499.000 ₫
                </strong>

                <del className="original-price">
                  999.000 ₫
                </del>

                <span className="discount-badge">
                  -50%
                </span>
              </div>

              <p className="product-notice">
                Demo pricing only. No real purchases
                or payments are processed.
              </p>
            </div>
          </article>

          {/* Inventory state machine */}
          <FlashSaleInventory
            key={saleLive ? "live" : "waiting"}
            isSaleLive={saleLive}
          />
        </section>

        {/* Information */}
        <section
          className="information-section"
          aria-labelledby="information-title"
        >
          <h2 id="information-title">
            How the Flash Sale Works
          </h2>

          <div className="information-grid">
            <article>
              <h3>1. Countdown</h3>
              <p>
                Start the precision countdown.
                Flash-sale reservations open when
                the timer reaches zero.
              </p>
            </article>

            <article>
              <h3>2. Reserve</h3>
              <p>
                Reserve an available product.
                Inventory is temporarily locked
                to prevent overselling in this simulation.
              </p>
            </article>

            <article>
              <h3>3. Checkout</h3>
              <p>
                Confirm your simulated purchase,
                cancel a reservation, or test
                payment failure recovery.
              </p>
            </article>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="site-footer">
        <p>
          FLASH SALE VN – High-Concurrency
          E-Commerce Simulation
        </p>

        <p>
          Web Application Development | Homework 3
        </p>

        <p>
          React + TypeScript | WCAG 2.2 AA Target
        </p>
      </footer>
    </div>
  );
}

export default App;
