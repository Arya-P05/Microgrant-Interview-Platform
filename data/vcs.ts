export interface VCProfile {
  name: string;
  company: string;
  title: string;
  bio: string;
  image: string;
}

export const VC_PROFILES: VCProfile[] = [
  {
    name: "Jimmy Yun",
    company: "8VC",
    title: "Principal",
    bio: "Jimmy is a Principal at 8VC, focusing on partnering with builders in enterprise software and frontier technology.",
    image: "/jimmy.jpeg",
  },
  {
    name: "Irene (Heejin) Koo",
    company: "Soma Capital",
    title: "Investing, scouting & community",
    bio: "Irene has a learning & tech masters from Harvard and loves chatting with cool people.",
    image: "/irene.jpeg",
  },
  {
    name: "Andrew Martinko",
    company: "Velocity",
    title: "Investor Relations & Fundraising Coach",
    bio: "Andrew helps companies at Velocity prepare for and execute their fundraise, and also connects the right investors and startups together.",
    image: "/andrew.jpeg",
  },
  {
    name: "Krysta Traianovski",
    company: "Velocity",
    title: "Associate Director, Founder Development",
    bio: "Krysta supports the entrepreneurship talent pipeline, or as she likes to say, 'I help students bring their ideas to life!'.",
    image: "/krysta.jpeg",
  },
  {
    name: "Mischa Hamara",
    company: "Next36",
    title: "Director of Programs",
    bio: "Mischa is the program director at Next36 and is involved with venture building, program design & recruitment.",
    image: "/mischa.jpeg",
  },
];
