// Plain-language descriptions of the 16 classes the model was trained on.
// General background only, written from standard plant-pathology knowledge; it is not part of the
// model output and not treatment advice. Keys are the exact class names used in the dataset.
export type Cause = "Healthy" | "Fungus" | "Virus" | "Bacterium" | "Water mould" | "Pest" | "Environment" | "Genetic";

export type DiseaseInfo = {
  name: string;
  cause: Cause;
  agent?: string;
  summary: string;
  signs: string;
};

export const DISEASES: Record<string, DiseaseInfo> = {
  healthy: {
    name: "Healthy leaf",
    cause: "Healthy",
    summary: "No disease or damage was recognised on this leaf.",
    signs: "Even green colour, no spots, patches, holes or distortion.",
  },
  anthracnose: {
    name: "Anthracnose",
    cause: "Fungus",
    agent: "Colletotrichum",
    summary: "A fungal disease that damages the leaf tissue.",
    signs: "Sunken or dry brown to tan lesions on leaves, sometimes with darker edges.",
  },
  black_shank: {
    name: "Black shank",
    cause: "Water mould",
    agent: "Phytophthora nicotianae",
    summary: "A serious soil-borne disease of tobacco that starts in the roots and stem base.",
    signs: "Leaves yellow and wilt, often starting on one side; the stem base turns black.",
  },
  brown_spot: {
    name: "Brown spot",
    cause: "Fungus",
    agent: "Alternaria",
    summary: "A common fungal leaf disease, more frequent on older leaves.",
    signs: "Round brown spots, often with rings like a target, that can grow and merge.",
  },
  cmv: {
    name: "Cucumber mosaic virus (CMV)",
    cause: "Virus",
    summary: "A virus that infects tobacco and is spread mainly by aphids. The name comes from the cucumber, where it was first described.",
    signs: "Light and dark green mottling (mosaic), puckered or narrow, stringy leaves, stunted growth.",
  },
  frog_eye: {
    name: "Frogeye leaf spot",
    cause: "Fungus",
    agent: "Cercospora nicotianae",
    summary: "A fungal leaf disease favoured by warm, humid weather.",
    signs: "Round spots with a pale grey or white centre and a dark border, like a frog's eye.",
  },
  genetic_abnormality: {
    name: "Genetic abnormality",
    cause: "Genetic",
    summary: "An irregularity in the plant itself (inherited or a mutation), not an infection.",
    signs: "Unusual leaf shape, colour or pattern that is not caused by a pathogen or pest.",
  },
  nematodes: {
    name: "Nematode damage",
    cause: "Pest",
    agent: "Root-knot nematodes (Meloidogyne)",
    summary: "Microscopic soil worms that attack the roots, so the leaves show the effect indirectly.",
    signs: "Stunted plants, yellowing and wilting in patches; swollen galls on the roots.",
  },
  potato_tuber_moth: {
    name: "Potato tuber moth damage",
    cause: "Pest",
    agent: "Phthorimaea operculella",
    summary: "An insect pest that also attacks tobacco. Its caterpillars feed inside the leaf.",
    signs: "Winding tunnels (mines) or transparent blotches in the leaf, and small holes.",
  },
  pvy: {
    name: "Potato virus Y (PVY)",
    cause: "Virus",
    summary: "A virus that infects tobacco and is spread by aphids. The name comes from the potato, where it was first described.",
    signs: "Mottling, dark or dead veins on the underside of leaves, and dead patches in some strains.",
  },
  sunscald: {
    name: "Sunscald",
    cause: "Environment",
    summary: "Damage from intense sun and heat, not an infection.",
    signs: "Bleached, whitish or papery dry patches, usually on the parts of the leaf facing the sun.",
  },
  target_spot: {
    name: "Target spot",
    cause: "Fungus",
    agent: "Rhizoctonia solani",
    summary: "A fungal leaf disease that is common in warm, wet conditions.",
    signs: "Brown spots with rings like a target; the dead centre may drop out, leaving holes.",
  },
  tmv: {
    name: "Tobacco mosaic virus (TMV)",
    cause: "Virus",
    summary: "A very stable virus that spreads by touch, tools and hands.",
    signs: "Light and dark green mosaic pattern, curled or distorted leaves, stunted growth.",
  },
  tswv: {
    name: "Tomato spotted wilt virus (TSWV)",
    cause: "Virus",
    summary: "A virus that infects tobacco and is spread by thrips (tiny insects). The name comes from the tomato, where it was first described.",
    signs: "Brown or bronze ring spots and dead patches on leaves, wilting, and stunting.",
  },
  weather_fleck: {
    name: "Weather fleck",
    cause: "Environment",
    summary: "Leaf damage from air pollution (ozone), not an infection.",
    signs: "Many small white, tan or grey flecks, mostly on the upper side of older leaves.",
  },
  wildfire: {
    name: "Wildfire",
    cause: "Bacterium",
    agent: "Pseudomonas syringae pv. tabaci",
    summary: "A bacterial disease that spreads in wet, windy weather.",
    signs: "Brown spots surrounded by a wide yellow halo that can join together.",
  },
};

/** Readable name for any label; falls back to the raw label if it is not one of the 16 known classes. */
export const niceName = (label: string) => DISEASES[label]?.name ?? label.replaceAll("_", " ");
