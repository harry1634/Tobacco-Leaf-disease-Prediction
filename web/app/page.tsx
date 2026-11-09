import Link from "next/link";
import { LandingNav } from "@/components/layout/LandingNav";
import { Card } from "@/components/ui/Card";
import { DISEASES, niceName } from "@/lib/diseases";

const features = [
  ["Disease diagnosis", "Upload a tobacco leaf image and get the predicted condition, its confidence and a plain-language explanation from the trained model."],
  ["Federated experiments", "Compare FedAvg, adaptive client selection, Top-k compression, and the combined approach under identical conditions."],
  ["Results analytics", "Accuracy, loss, macro-F1, communication cost and client participation, drawn only from real imported runs."],
  ["Transparent method", "Every selection rule, compression setting and accounting choice is documented on the project page."],
];

const steps = [
  ["1", "Select", "The server picks which clients take part in the round, at random or by an adaptive score."],
  ["2", "Train", "Each chosen client trains MobileNetV2 on its own leaf images. Images never leave the client."],
  ["3", "Compress", "Clients send back only the largest k% of their model update."],
  ["4", "Aggregate", "The server rebuilds and averages the updates (FedAvg) and starts the next round."],
];


const classes = Object.keys(DISEASES);

const tryIt = [
  ["Create an account", "Register with an email and password. Your data is private to you."],
  ["Upload a leaf photo", "JPEG, PNG or WebP. Large photos are shrunk in your browser first, and the photo itself is never saved."],
  ["Read the result", "See the likely condition, how confident the model is, what it usually looks like, and the next three guesses."],
];

// Illustration only: one server in the middle, clients around it, updates travelling both ways.
function FederatedIllustration() {
  const clients = [0, 1, 2, 3, 4, 5].map((i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return { x: 160 + Math.cos(a) * 95, y: 110 + Math.sin(a) * 82 };
  });
  return (
    <svg viewBox="0 0 320 220" role="img" aria-label="Illustration: several clients each send model updates to one central server, and the server sends the averaged model back. Photos stay on the clients." className="h-auto w-full max-w-sm">
      {clients.map((c, i) => (
        <line key={i} x1={160} y1={110} x2={c.x} y2={c.y} className="stroke-border" strokeWidth={2} strokeDasharray="4 4" />
      ))}
      {clients.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r={17} className="fill-surface stroke-primary" strokeWidth={2} />
          <path d={`M${c.x - 6} ${c.y + 4} q6 -12 12 0`} className="fill-none stroke-primary" strokeWidth={2} strokeLinecap="round" />
          <circle cx={c.x} cy={c.y - 3} r={2} className="fill-primary" />
        </g>
      ))}
      <circle cx={160} cy={110} r={30} className="fill-primary" />
      <text x={160} y={114} textAnchor="middle" className="fill-background text-[11px] font-semibold">Server</text>
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-semibold text-primary">Tobacco FL Diagnosis</span>
          <LandingNav />
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-12">
        <section className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="text-sm font-medium text-primary">B.Tech final-year project</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Adaptive Federated Learning for Tobacco Leaf Disease Diagnosis via Client Selection and Gradient Compression
            </h1>
            <p className="mt-4 max-w-2xl text-muted">
              A research dashboard and diagnosis interface that studies how smarter client selection and compressed model updates can
              lower communication cost in federated learning, without sharing raw leaf images.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary-hover">Get started</Link>
              <Link href="/login" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-primary-soft">Log in</Link>
            </div>
          </div>
          <div className="flex justify-center rounded-lg border border-border bg-surface p-4">
            <FederatedIllustration />
          </div>
        </section>

        <section className="mt-12 grid gap-4 md:grid-cols-2" aria-label="Background">
          <Card title="Tobacco leaf disease diagnosis">
            <p className="text-sm leading-6">
              Leaf diseases reduce tobacco yield and quality, and early recognition lets growers act sooner. The classifier uses
              MobileNetV2, a compact network suited to limited hardware, and distinguishes 16 leaf conditions from a published research dataset.
            </p>
          </Card>
          <Card title="Federated learning">
            <p className="text-sm leading-6">
              Several clients, such as farms or institutions, train on their own images and send only model updates to a server that
              averages them. The raw images stay where they are, which suits private or distributed agricultural data.
            </p>
          </Card>
        </section>

        <section className="mt-12" aria-labelledby="how">
          <h2 id="how" className="text-xl font-semibold">How one training round works</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([n, title, text]) => (
              <li key={n} className="rounded-lg border border-border bg-surface p-4">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden>{n}</span>
                <p className="mt-2 font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="features">
          <h2 id="features" className="text-xl font-semibold">Main features</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {features.map(([title, text]) => (
              <li key={title}>
                <Card title={title}><p className="text-sm leading-6">{text}</p></Card>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="conditions">
          <h2 id="conditions" className="text-xl font-semibold">What the model can recognise</h2>
          <p className="mt-1 text-sm text-muted">{classes.length} conditions from the TLA research dataset, including healthy leaves.</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {classes.map((c) => (
              <li key={c} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">{niceName(c)}</li>
            ))}
          </ul>
        </section>

        <section className="mt-12" aria-labelledby="try">
          <h2 id="try" className="text-xl font-semibold">Try it in three steps</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {tryIt.map(([title, text], i) => (
              <li key={title} className="rounded-lg border border-border bg-surface p-4">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden>{i + 1}</span>
                <p className="mt-2 font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12" aria-labelledby="status">
          <h2 id="status" className="text-xl font-semibold">Project status</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card title="Working now">
              <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                <li>Leaf diagnosis with a trained MobileNetV2 classifier.</li>
                <li>Baseline accuracy of 84.1% (macro-F1 0.729) on 138 photos the earlier model had never seen, give or take about 6 points.</li>
                <li>Accounts, private per-user data and tested security rules.</li>
                <li>All four federated experiments have been run once each. Top-k compression cut the data clients upload by about 79% with no clear change in accuracy, while adaptive client selection showed no consistent benefit. These are single runs, so they are indications, not proof.</li>
              </ul>
            </Card>
            <Card title="Still to come">
              <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
                <li>Showing the federated results in the charts here (they still need to be imported), and repeating the experiments with several random seeds.</li>
                <li>Testing on photos from other cameras and farms; results on outside photos are less certain.</li>
              </ul>
            </Card>
          </div>
        </section>

        <section className="mt-12 rounded-lg border border-border bg-primary-soft p-6 text-center">
          <h2 className="text-lg font-semibold">Ready to check a leaf?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">Create an account, upload a photo and read the explanation.</p>
          <Link href="/register" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary-hover">Get started</Link>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted">
        Dataset: Tobacco Leaf Abnormality (TLA), Lin et al., Macao Polytechnic University. Academic project; not a substitute for expert diagnosis.
      </footer>
    </div>
  );
}
