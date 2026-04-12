import { surfacePaths } from '@/app/router/surface-paths';

export type ProjectFeature = {
  name: string;
  project: string;
  description: string;
  amount: string;
  category: string;
  image: string;
  imageAlt: string;
};

export type PastProjectYear = {
  year: string;
  href: string;
};

export const projectsHeroContent = {
  eyebrow: 'Projects',
  titleLines: ['Together We', 'Transform', 'Lives!'],
  heading: 'Empowering Missions Worldwide',
  description:
    'The ASI Missions Inc. Board selects projects each year to receive grants from the offering gathered at the ASI International Convention. Online donations are accepted to support current offerings and fulfill previous pledges. Each project is allocated funding to make a meaningful global impact. In the event that any project does not progress within a reasonable timeframe, as determined by ASI, funds may be redirected to another ASI-approved project.',
  followUp:
    'Below are the organizations selected to receive funding and the planned use of project funds.',
  overflowIntro:
    'Overflow contributions from the ASI Offering are directed to additional impactful initiatives, ensuring every gift supports the mission of sharing Christ worldwide.',
  primaryAction: {
    label: 'Funding Application',
    to: surfacePaths.institutional.projectFunding,
    variant: 'primary' as const,
  },
  secondaryAction: {
    label: 'Donate Today',
    to: surfacePaths.institutional.donate,
    variant: 'secondary' as const,
  },
} as const;

export const projectsHeroMedia = {
  image: 'https://asiministries.org/wp-content/uploads/projects.png',
  imageAlt: 'ASI mission projects collage',
  video: 'https://asiministries.org/wp-content/uploads/wfL-March-2024-1.mp4',
  videoLabel: 'Motivational mission project video',
} as const;

export const projectsImpactStats = [
  {
    value: '41',
    label: '2025 projects',
    description: 'Latest published offering collection from ASI Missions Inc.',
  },
  {
    value: '$1.932M',
    label: 'Allocated funding',
    description: 'Combined allocation across the published 2025 project list.',
  },
  {
    value: '3',
    label: 'Overflow projects',
    description: 'Additional initiatives supported when offerings exceed the goal.',
  },
] as const;

export const overflowProjects2025 = [
  'Ellen G. White Estate Digital Project',
  'Hearts for Mission International (Africa)',
  'Roofs Over Africa/One Day Church',
] as const;

export const currentProjects2025: ProjectFeature[] = [
  {
    name: 'ASAP Ministries',
    project:
      'To expand seven mission schools in West Thailand to reach multiple people groups.',
    description:
      'Local missionaries meet practical needs, build trust, and share the holistic gospel through education in underserved communities.',
    amount: '$100,000',
    category: 'Mission schools',
    image:
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Students gathered in a bright classroom',
  },
  {
    name: 'AudioVerse',
    project:
      'To expand audio Bible offerings and use AI to index Bible and Spirit of Prophecy content.',
    description:
      'The project improves Bible access and creates deeper study pathways by connecting sermons, passages, and topics.',
    amount: '$50,000',
    category: 'Digital discipleship',
    image:
      'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Laptop and study materials on a table',
  },
  {
    name: 'Child Impact International',
    project: 'To build a Rescue Campus in the Philippines.',
    description:
      'A safe haven for children that combines education, vocational training, spiritual guidance, and long-term care.',
    amount: '$25,000',
    category: 'Child protection',
    image:
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Children smiling during an outdoor community activity',
  },
  {
    name: 'Ellen G. White Estate, Inc.',
    project:
      'To establish an AI server and expand the digitization of translations.',
    description:
      'This work makes Spirit of Prophecy resources more accessible worldwide through digital search and translation expansion.',
    amount: '$100,000',
    category: 'Digital library',
    image:
      'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Library shelves filled with books',
  },
  {
    name: 'FARM STEW International',
    project: 'To train agricultural and health missionaries in Burundi.',
    description:
      'Women are equipped with biblical, agricultural, health, and savings principles that strengthen families and communities.',
    amount: '$20,000',
    category: 'Health and agriculture',
    image:
      'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Hands tending crops in a field',
  },
  {
    name: 'Hearts for Mission International',
    project: 'To provide funds to conduct two surgical camps.',
    description:
      'Surgical supplies, ultrasound units, and evangelistic materials support heart surgeries and outreach in Africa.',
    amount: '$100,000',
    category: 'Medical mission',
    image:
      'https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Medical worker caring for a child',
  },
  {
    name: 'Lay Institute for Global Health Training',
    project: 'To expand teaching teams and provide basic training materials.',
    description:
      'LIGHT strengthens global medical evangelism training by preparing course coordinators and practical outreach resources.',
    amount: '$100,000',
    category: 'Training',
    image:
      'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Small group studying together',
  },
  {
    name: 'One Day Church/Roofs Over Africa',
    project:
      'To provide quickly assembled church structures and steel roofing materials.',
    description:
      'Congregations in remote and underserved regions receive practical infrastructure that helps churches gather and grow.',
    amount: '$100,000',
    category: 'Church infrastructure',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Simple rural building surrounded by open landscape',
  },
  {
    name: 'Water for Life',
    project: 'To drill 35 new wells.',
    description:
      'Clean water access in Guatemala is paired with Bible workers who continue sharing living water after each well project.',
    amount: '$40,000',
    category: 'Clean water',
    image:
      'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=80',
    imageAlt: 'Person drawing clean water outdoors',
  },
];

export const pastProjectYears: PastProjectYear[] = [
  {
    year: '2024',
    href: 'https://asiministries.org/project-year/2024/',
  },
  {
    year: '2023',
    href: 'https://asiministries.org/project-year/2023/',
  },
  {
    year: '2022',
    href: 'https://asiministries.org/project-year/2022/',
  },
  {
    year: '2021',
    href: 'https://asiministries.org/project-year/2021/',
  },
  {
    year: '2020',
    href: 'https://asiministries.org/project-year/2020/',
  },
];
