import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LINKS } from "@/lib/links";
import { PRODUCTS } from "@/lib/products";

function External({ href, children, variant = "primary" as const }: { href: string; children: string; variant?: "primary" | "line" }) {
  return (
    <Button asChild variant={variant} className="w-full sm:w-auto">
      <a href={href} target="_blank" rel="noreferrer noopener">
        {children}
        <ArrowUpRight className="size-4" aria-hidden />
      </a>
    </Button>
  );
}

export function ToolsView() {
  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Deriv account</h2>
            <p className="mt-2 text-sm text-mist">
              Sign up or log in through Searchmixed. The same link opens the Deriv gateway for a new account or an existing one.
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <External href={LINKS.signup}>Sign up</External>
            <External href={LINKS.signup} variant="line">
              Log in
            </External>
          </div>
        </article>
        <article className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Trading VPS</h2>
            <p className="mt-2 text-sm text-mist">
              Keep MetaTrader and your indicators online when the laptop sleeps. Charts, alerts, and tools stay up.
            </p>
          </div>
          <div className="mt-auto">
            <External href={LINKS.vps}>Buy VPS</External>
          </div>
        </article>
        <article className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight">WhatsApp desk</h2>
            <p className="mt-2 text-sm text-mist">
              Join the Searchmixed community for setup help, VPS questions, and tool support.
            </p>
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-3">
            <External href={LINKS.whatsapp}>Join WhatsApp</External>
            <a
              className="text-sm text-mist underline-offset-4 hover:text-ink hover:underline"
              href={LINKS.telegram}
              target="_blank"
              rel="noreferrer noopener"
            >
              Telegram
            </a>
          </div>
        </article>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl tracking-tight">MQL5 tools</h2>
            <p className="mt-2 max-w-2xl text-sm text-mist">
              Indicators by Israr Hussain Shah. Order flow, liquidity, volume profile, and Deriv synthetic tools. Price is on the MQL5 listing.
            </p>
          </div>
          <Button asChild variant="line">
            <a href={LINKS.seller} target="_blank" rel="noreferrer noopener">
              All products
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PRODUCTS.map((product) => (
            <article key={product.href} className="flex flex-col gap-4 rounded-xl border border-line bg-panel p-4">
              <div>
                <div className="text-xs tracking-wide text-faint uppercase">{product.tag}</div>
                <h3 className="mt-2 text-lg font-medium">{product.name}</h3>
                <p className="mt-2 text-sm text-mist">{product.blurb}</p>
              </div>
              <div className="mt-auto">
                <Button asChild variant="line" size="sm">
                  <a href={product.href} target="_blank" rel="noreferrer noopener">
                    Buy
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
