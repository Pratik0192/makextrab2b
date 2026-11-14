import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#f8f5ef] px-5 pb-6 pt-12 md:px-12 md:pt-14">
      <div className="mx-auto grid max-w-[1360px] gap-8 border-b border-[#e4dcd2] pb-9 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link
            href="/"
            className="font-serif text-xl tracking-wide text-[#3e2424]"
          >
            Makextra Wholesale
          </Link>
          <p className="mt-4 max-w-xs text-xs leading-6 text-[#827572]">
            A considered wholesale saree partner for retailers, boutiques and
            resellers across India.
          </p>
        </div>
        <div>
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[.2em] text-[#634849]">
            Explore
          </h2>
          <ul className="space-y-3 text-xs text-[#827572]">
            <li>
              <Link href="/" className="hover:text-[#542d30]">
                Home
              </Link>
            </li>
            <li>
              <Link href="/products" className="hover:text-[#542d30]">
                Products
              </Link>
            </li>
            <li>
              <Link href="/categories" className="hover:text-[#542d30]">
                Categories
              </Link>
            </li>
            <li>
              <Link href="/collections" className="hover:text-[#542d30]">
                Collections
              </Link>
            </li>
          </ul>
        </div>
        <div className="lg:col-span-2">
          <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[.2em] text-[#634849]">
            Wholesale enquiries
          </h2>
          <p className="max-w-lg text-xs leading-6 text-[#827572]">
            Browse the catalogue and connect with our team to plan an assortment
            for your business.
          </p>
          <Link
            href="/products"
            className="mt-3 inline-block text-xs font-medium text-[#542d30]"
          >
            Browse products →
          </Link>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1360px] flex-col justify-between gap-2 pt-5 text-[10px] text-[#948680] sm:flex-row">
        <span>
          © {new Date().getFullYear()} Makextra Wholesale. All rights reserved.
        </span>
        <span>Wholesale sarees, thoughtfully sourced.</span>
      </div>
    </footer>
  );
}
