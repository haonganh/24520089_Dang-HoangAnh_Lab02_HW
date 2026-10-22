
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="site-header">
        <div className="header-content">
          <span className="brand">FLASH SALE VN</span>
          <span className="sale-badge">11.11 MEGA SALE</span>
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
            Experience a flash-sale simulation
            powered by a precision countdown timer,
            optimistic inventory reservations,
            and a checkout state machine.
          </p>
        </section>

        <section
          className="countdown-section"
          aria-labelledby="countdown-title"
        >
          <h2 id="countdown-title">
            Flash Sale Countdown
          </h2>

          <p>
            The precision countdown engine
            will be implemented in T02–T03.
          </p>

          <p className="info-message">
            Countdown status: Not initialized
          </p>
        </section>

        <section
          className="products-section"
          aria-labelledby="products-title"
        >
          <h2 id="products-title">
            Flash Sale Products
          </h2>

          <p>
            Product inventory and reservation
            functionality will be implemented
            in T04–T05.
          </p>

          <div className="product-placeholder">
            <h3>Product Catalog</h3>
            <p>
              Flash-sale products coming soon.
            </p>
          </div>
        </section>

        <section
          className="checkout-section"
          aria-labelledby="checkout-title"
        >
          <h2 id="checkout-title">
            Checkout
          </h2>

          <p>
            Secure checkout simulation and
            inventory rollback will be
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
