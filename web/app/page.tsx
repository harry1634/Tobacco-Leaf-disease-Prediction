import Link from "next/link";
import { LandingNav } from "@/components/layout/LandingNav";
import { Card } from "@/components/ui/Card";

const features = [
  ["Disease diagnosis", "Upload a tobacco leaf image and see the predicted class with its confidence, once a trained model is connected."],
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
        <section>
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
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted">
        Dataset: Tobacco Leaf Abnormality (TLA), Lin et al., Macao Polytechnic University. Academic project; not a substitute for expert diagnosis.
      </footer>
    </div>
  );
}
