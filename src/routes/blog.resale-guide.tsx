import { createFileRoute, Link } from "@tanstack/react-router";

const URL = "https://scanything.app/blog/resale-guide";
const TITLE = "How to Identify Household Items by Photo for Resale";
const DESCRIPTION =
  "Learn how to identify an object by photo — furniture, appliances, decor — and find its resale value fast with AI-assisted pricing research.";

export const Route = createFileRoute("/blog/resale-guide")({
  head: () => ({
    meta: [
      { title: `${TITLE} — Scanything` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: TITLE,
          description: DESCRIPTION,
          url: URL,
          step: [
            { "@type": "HowToStep", name: "Photograph the item clearly", text: "Shoot the whole item in even light, plus close-ups of labels, model plates and maker's marks." },
            { "@type": "HowToStep", name: "Identify the object by photo", text: "Run the photo through Scanything to get the item type, likely brand and category in seconds." },
            { "@type": "HowToStep", name: "Confirm the exact model", text: "Use 'Analyze further' to read model numbers and narrow a generic result down to a specific product." },
            { "@type": "HowToStep", name: "Check the price range", text: "Scanything returns an estimated resale range and links you straight to live marketplace listings." },
            { "@type": "HowToStep", name: "Grade condition and price it", text: "Adjust within the range for wear, missing parts and local demand, then list with the details you captured." },
          ],
        }),
      },
    ],
  }),
  component: ResaleGuidePage,
});

const STEPS = [
  {
    title: "1. Take a photo that an AI can actually read",
    body: "Good input beats clever software. Shoot the full item against a plain background in daylight, then take close-ups of anything printed: a model plate on an appliance, a stamp under a chair, a label inside a drawer. Those small frames are what turn 'a wooden chair' into 'a mid-century teak dining chair'.",
  },
  {
    title: "2. Identify the object by photo",
    body: "Open Scanything and scan the item. Instead of typing guesses into a search bar, the camera labels what it sees — sofa, drill, blender, floor lamp — and puts a tappable square on each object in the room. Tap one and you get the item name, category and a short description of what it most likely is.",
  },
  {
    title: "3. Narrow a generic label down to a specific model",
    body: "Resale value lives in specifics. 'Stand mixer' is worth guessing about; a named model with a known capacity is worth pricing. Use Analyze further on any item and Scanything digs into visible text, badges and design details to propose a brand and model, plus links to the manufacturer or retailer page when it can find one.",
  },
  {
    title: "4. Read the price range before you list",
    body: "Every identified item comes back with an estimated price range rather than a single number, because resale prices move with condition, region and season. Treat the top of the range as 'excellent, complete, in demand' and the bottom as 'worn, missing parts, slow local market'.",
  },
  {
    title: "5. Grade the condition honestly",
    body: "Check for structural damage, missing accessories, power cords, remotes, cushions and manuals. A complete item with its original parts routinely sells for far more than the same item sold bare. Note every flaw in your listing — it reduces returns and disputes far more than it reduces price.",
  },
  {
    title: "6. Do a whole room in one pass",
    body: "For house clearances and estate lots, switch to Video Scan and walk the room. Scanything tracks up to ten items at a time and keeps a running list of everything it has seen, so you leave with an inventory instead of a camera roll you still have to sort through.",
  },
];

const CATEGORIES = [
  { name: "Furniture", tip: "Look underneath for maker's stamps and joinery style — solid wood and named designers carry most of the value." },
  { name: "Appliances", tip: "The model plate is everything. Photograph it, and note whether the item powers on." },
  { name: "Electronics", tip: "Generation and storage size change the price more than cosmetic condition does." },
  { name: "Tools", tip: "Corded and cordless versions of the same tool price very differently; batteries and chargers add real value." },
  { name: "Decor and homeware", tip: "Marks on the base of ceramics and glass are often the only route to a brand." },
  { name: "Toys and games", tip: "Completeness rules. Original box and all pieces can multiply the price." },
];

function ResaleGuidePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to Scanything
          </Link>
          <span className="text-xs text-muted-foreground">Guide</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <article>
          <p className="text-xs uppercase tracking-widest text-primary/80">Reselling</p>
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{TITLE}</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            The slowest part of reselling is not listing or shipping — it is working out what
            something is. This guide walks through how to identify an object by photo, confirm the
            exact model, and turn that into a defensible price for furniture, appliances and the
            rest of a household.
          </p>

          <section className="mt-10 space-y-8">
            <h2 className="text-2xl font-semibold">The workflow, step by step</h2>
            {STEPS.map((step) => (
              <div key={step.title}>
                <h3 className="text-lg font-semibold text-primary">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold">What to look for, by category</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {CATEGORIES.map((cat) => (
                <div key={cat.name} className="rounded-lg border border-border/60 p-4">
                  <h3 className="font-semibold">{cat.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{cat.tip}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold">How Scanything automates the pricing research</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Done manually, pricing one item means describing it in a search box, guessing at the
              brand, scrolling sold listings and averaging what you find. Scanything collapses that
              into a single camera pass: point at the item, get the identification, the estimated
              price range and the reference links in one card. For a full room, the live scan builds
              the inventory list while you walk, so a clearance that used to take an afternoon of
              research becomes a few minutes of scanning and a short review pass.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/"
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Scan an item now
              </Link>
              <Link
                to="/pricing"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
              >
                See credit pricing
              </Link>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Common mistakes</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>Pricing from asking prices instead of what items actually sold for.</li>
              <li>Skipping the model plate and listing a specific product as a generic one.</li>
              <li>Photographing in low light, which hides both flaws and identifying marks.</li>
              <li>Selling a set piece by piece when the complete set is worth more together.</li>
              <li>Ignoring local demand — bulky furniture prices differ sharply between markets.</li>
            </ul>
          </section>
        </article>
      </main>
    </div>
  );
}
