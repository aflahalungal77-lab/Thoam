
import Link from "next/link";
import Image from "next/image";
import {
  Store,
  Package,
  ClipboardList,
  QrCode,
  ChartNoAxesCombined,
  ArrowRight,
  ArrowUpRight,
  Check,
  Smartphone,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import InstallPrompt from "@/components/InstallPrompt";

const features = [
  {
    icon: Package,
    number: "01",
    title: "Your menu, your way.",
    description:
      "Add products, update prices, organise categories and control item availability from your restaurant dashboard.",
    tag: "MENU MANAGEMENT",
  },
  {
    icon: ClipboardList,
    number: "02",
    title: "Orders, organised.",
    description:
      "Review incoming orders and manage preparation status for delivery and dine-in orders.",
    tag: "ORDER MANAGEMENT",
  },
  {
    icon: ChartNoAxesCombined,
    number: "03",
    title: "Know your business.",
    description:
      "Understand daily sales, order activity and your best-selling items using your actual business data.",
    tag: "BUSINESS INSIGHTS",
  },
  {
    icon: QrCode,
    number: "04",
    title: "A menu at every table.",
    description:
      "Enable QR-based ordering for your restaurant tables and give customers a convenient way to explore your menu.",
    tag: "QR ORDERING",
  },
];

export default function OwnerPage() {
  return (
    <>
      <InstallPrompt audience="owner" />

      <header className="owner-header">
        <Link href="/" className="owner-brand" aria-label="Tho'am home">
          <Image
            src="/icon.svg"
            alt="Tho'am"
            width={42}
            height={42}
            priority
          />
        
        </Link>

        <div className="owner-header-center">
          <span className="owner-status-dot" />
          PARTNER PORTAL
        </div>

        <Link
          className="owner-login-button"
          href="/auth?role=owner&next=/restaurant-admin"
        >
          Owner login
          <ArrowUpRight size={16} />
        </Link>
      </header>

      <main className="owner-page">
        {/* Hero */}
        <section className="owner-hero">
          <div className="owner-hero-content">
            <div className="owner-eyebrow">
              <span className="owner-eyebrow-line" />
              THE THO'AM PARTNER EXPERIENCE
            </div>

            <h1>
              Your restaurant.
              <br />
              <span>Ready for more.</span>
            </h1>

            <p className="owner-hero-description">
              One simple space to manage your menu, handle orders,
              follow sales and bring your restaurant closer to local
              customers.
            </p>

            <div className="owner-hero-actions">
              <Link
                className="owner-primary-button"
                href="/auth?role=owner&next=/restaurant-admin"
              >
                Open your dashboard
                <ArrowRight size={17} />
              </Link>

              <Link
                className="owner-secondary-button"
                href="/auth?role=owner&mode=signup&next=/restaurant-admin"
              >
                Register your restaurant
                <Store size={16} />
              </Link>
            </div>

            <div className="owner-trust-note">
              <ShieldCheck size={16} />
              <span>
                Restaurant listings go live after admin approval.
              </span>
            </div>
          </div>

          <div className="owner-hero-visual" aria-hidden="true">
            <div className="owner-visual-grid" />

            <div className="owner-dashboard-card">
              <div className="owner-dashboard-top">
                <div className="owner-dashboard-brand">
                  <div className="owner-mini-logo">
                    <Store size={17} />
                  </div>
                  <div>
                    <strong>Partner space</strong>
                    <span>Restaurant overview</span>
                  </div>
                </div>

                <span className="owner-live-indicator">
                  <span />
                  YOUR BUSINESS
                </span>
              </div>

              <div className="owner-dashboard-divider" />

              <div className="owner-dashboard-label">
                YOUR RESTAURANT TOOLKIT
              </div>

              <div className="owner-tool-row">
                <div className="owner-tool-icon">
                  <Package size={20} />
                </div>
                <div>
                  <strong>Menu management</strong>
                  <span>Products & availability</span>
                </div>
                <ArrowUpRight size={16} />
              </div>

              <div className="owner-tool-row">
                <div className="owner-tool-icon">
                  <ClipboardList size={20} />
                </div>
                <div>
                  <strong>Order management</strong>
                  <span>Incoming orders</span>
                </div>
                <ArrowUpRight size={16} />
              </div>

              <div className="owner-tool-row">
                <div className="owner-tool-icon">
                  <QrCode size={20} />
                </div>
                <div>
                  <strong>Table QR ordering</strong>
                  <span>Digital menu access</span>
                </div>
                <ArrowUpRight size={16} />
              </div>

              <div className="owner-dashboard-bottom">
                <ShieldCheck size={16} />
                <span>One space. Your restaurant.</span>
              </div>
            </div>

            <div className="owner-floating-card owner-floating-top">
              <div className="owner-floating-icon">
                <TrendingUp size={18} />
              </div>
              <div>
                <strong>Business insights</strong>
                <span>Understand your sales</span>
              </div>
            </div>

            <div className="owner-floating-card owner-floating-bottom">
              <div className="owner-floating-icon">
                <Smartphone size={18} />
              </div>
              <div>
                <strong>Made for mobile</strong>
                <span>Your partner PWA</span>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits strip */}
        <section className="owner-benefits">
          <div>
            <Check size={17} />
            <span>Manage your menu</span>
          </div>
          <div>
            <Check size={17} />
            <span>Handle your orders</span>
          </div>
          <div>
            <Check size={17} />
            <span>Enable table QR ordering</span>
          </div>
          <div>
            <Check size={17} />
            <span>Review business activity</span>
          </div>
        </section>

        {/* Features */}
        <section className="owner-features-section">
          <div className="owner-section-heading">
            <div>
              <div className="owner-eyebrow">
                <span className="owner-eyebrow-line" />
                EVERYTHING IN ONE PLACE
              </div>

              <h2>
                Built around
                <br />
                <span>your daily work.</span>
              </h2>
            </div>

            <p>
              Practical tools designed to help you manage everyday
              restaurant operations from one partner dashboard.
            </p>
          </div>

          <div className="owner-feature-grid">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <article className="owner-feature-card" key={feature.number}>
                  <div className="owner-feature-top">
                    <div className="owner-feature-icon">
                      <Icon size={22} strokeWidth={1.7} />
                    </div>
                    <span>{feature.number}</span>
                  </div>

                  <div className="owner-feature-tag">{feature.tag}</div>

                  <h3>{feature.title}</h3>

                  <p>{feature.description}</p>

                  <div className="owner-feature-bottom">
                    <span />
                    THO'AM PARTNER TOOLS
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* Registration CTA */}
        <section className="owner-join-section">
          <div className="owner-join-icon">
            <Store size={26} strokeWidth={1.6} />
          </div>

          <div className="owner-join-content">
            <div className="owner-eyebrow">
              YOUR NEXT STEP STARTS HERE
            </div>

            <h2>
              Let’s get your
              <br />
              restaurant online.
            </h2>

            <p>
              Create your restaurant account and set up your partner
              profile. Your listing will be reviewed before going live.
            </p>
          </div>

          <div className="owner-join-actions">
            <Link
              href="/auth?role=owner&mode=signup&next=/restaurant-admin"
              className="owner-join-primary"
            >
              Get started
              <ArrowRight size={17} />
            </Link>

            <Link
              href="/auth?role=owner&next=/restaurant-admin"
              className="owner-join-secondary"
            >
              Already registered? Sign in
            </Link>
          </div>

          <div className="owner-join-watermark" aria-hidden="true">
            <Store size={150} strokeWidth={0.6} />
          </div>
        </section>

        {/* Footer */}
        <footer className="owner-footer">
          <Link href="/" className="owner-footer-brand">
            <Image
              src="/logo.png"
              alt="Tho'am"
              width={29}
              height={29}
            />
          </Link>

          <span>Built for local food businesses.</span>

          <Link href="/" className="owner-footer-link">
            Customer website
            <ArrowUpRight size={14} />
          </Link>
        </footer>
      </main>
    </>
  );
}
