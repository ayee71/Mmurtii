export interface LandmarkPrecedent {
  fileNumber: string;
  category: string;
  title: {
    om: string;
    en: string;
  };
  parties: {
    om: string;
    en: string;
  };
  issue: {
    om: string;
    en: string;
  };
  keyPrinciple: {
    om: string;
    en: string;
  };
  statutes: string;
  legalIssue: {
    om: string;
    en: string;
  };
  significance: {
    om: string;
    en: string;
  };
}

export interface VolumeSection {
  sectionTitle: {
    om: string;
    en: string;
  };
  topics: {
    om: string[];
    en: string[];
  };
}

export interface CassationVolume {
  volume: number;
  amharicLabel: string;
  yearEth: string;
  yearGreg: string;
  publicationYear: number;
  title: {
    om: string;
    en: string;
  };
  theme: {
    om: string;
    en: string;
  };
  overview: {
    om: string;
    en: string;
  };
  caseCount: number;
  totalCasesEstimated: number;
  categories: string[];
  sections: VolumeSection[];
  landmarkCases: LandmarkPrecedent[];
}

export const CASSATION_VOLUMES_1_TO_28: CassationVolume[] = [
  {
    volume: 22,
    amharicLabel: 'ቅጽ 22',
    yearEth: '2013/14',
    yearGreg: '2021',
    publicationYear: 2021,
    title: {
      om: 'Murtiiwwan Dhaddacha Ijibbaataa Jildii 22ffaa (Mirga Qabiyyee Lafa Baadiyaa fi Darbiinsa Yeroo)',
      en: 'Federal Supreme Court Cassation Decisions Volume 22 (Rural Land Holding & Limitation)'
    },
    theme: {
      om: 'Mirga qabiyyee lafaa wal-fuutotaa, darbiinsa yeroo lafa baadiyaa waggaa 12, fi qoodiinsa qabeenya gaa\'ilaa.',
      en: 'Spousal rural land holding rights, 12-year limitation period in Oromia land law, and marital property partition.'
    },
    overview: {
      om: 'Jildiin kun murtiilee ijoo mirga qabiyyee lafa baadiyaa, dambii 151/2005, fi seera maatii irratti kennaman qabateera.',
      en: 'This volume features landmark binding rulings regarding rural land tenure certificates, regional limitation laws, and property distribution.'
    },
    caseCount: 2,
    totalCasesEstimated: 85,
    categories: ['land_rights', 'limitation', 'family'],
    sections: [
      {
        sectionTitle: { om: '1. Lafa Baadiyaa fi Mirga Qabiyyee', en: '1. Rural Land Rights & Tenure' },
        topics: {
          om: ['Mirga qabiyyee lafa baadiyaa walfuutotaa du\'aan booda', 'Darbiinsa yeroo waggaa 12'],
          en: ['Surviving spouse rural land rights', '12-year statute of limitations']
        }
      }
    ],
    landmarkCases: [
      {
        fileNumber: '138286',
        category: 'land_rights',
        title: {
          om: 'Mirga Qabiyyee Lafaa Walfuutota Lubbuun Jiraniifi Qixxummaa Dubartootaa',
          en: 'Surviving Spouse Rural Land Holding Rights'
        },
        parties: { om: 'Aadde Masarat Tsaggaaye vs. Obbo Abdataa Dachaasaa', en: 'Mrs. Melsech Tsegaye v. Mr. Abdata Dachasa' },
        issue: { om: 'Mirga qabiyyee lafaa erga hiriyaan gaa\'ilaa du\'ee booda', en: 'Right to sole land certification after spouse bereavement' },
        keyPrinciple: {
          om: 'Haati warraa ykn abbaan warraa erga hiriyaan gaa\'ilaa du\'ee booda mirga qabiyyee lafaa dhuunfaan maqaa ofiitiin galmeessisuu fi waraqaa ragaa fudhachuu qaba.',
          en: 'A surviving spouse possesses an absolute right to register rural land holdings in their sole name and receive certification upon the death of the other spouse.'
        },
        statutes: 'Heera RDFI Kwt 35(7), Labsii 456/1997, Labsii 242/2014 Kwt 14',
        legalIssue: {
          om: 'Dhaaltotni biroo qabiyyee kana irraa isaan ari\'uu ni danda\'uu?',
          en: 'Can other heirs dispossess the surviving spouse of joint rural holdings?'
        },
        significance: {
          om: 'Mirga qabiyyee dubartootaa lafa baadiyaa irratti eeguuf murtee bu\'uuraati.',
          en: 'Landmark precedent safeguarding women and surviving spouses tenure security in rural land administration.'
        }
      },
      {
        fileNumber: '140538',
        category: 'limitation',
        title: {
          om: 'Darbiinsa Yeroo Waggaa 12 Lafa Baadiyaa Oromiyaa',
          en: '12-Year Statutory Period of Limitation on Oromia Rural Land'
        },
        parties: { om: 'Obbo Kabbadaa Guddataa vs. Biiroo Lafaa Oromiyaa', en: 'Mr. Kebede Gudata v. Oromia Land Bureau' },
        issue: { om: 'Gaaffiin deebisiisuu lafa baadiyaa darbiinsa yeroo waggaa 12tiin ni cufamaa?',
          en: 'Whether restitution actions for Oromia rural land are barred after 12 years of continuous holding.'
        },
        keyPrinciple: {
          om: 'Dambiin 151/2005 Kwt 32 darbiinsa yeroo waggaa 12 qofa dirqisiisa; himanni lafa deebisiisuu waggaa 12 booda yirgaadhaan cufama.',
          en: 'Under Oromia Regulation 151/2005 Art. 32, restitution actions for rural land are definitively barred after 12 years of open possession.'
        },
        statutes: 'Dambii 151/2005 Kwt 32, Seera Hariiroo Hawaasaa Kwt 1677(1)',
        legalIssue: {
          om: 'Seerri hariiroo hawaasaa fi dambiin addaa akkamitti wal cina qabamu?',
          en: 'Interaction between general civil limitation codes and specific regional land regulations.'
        },
        significance: {
          om: 'Nagaa qabiyyee lafa baadiyaa fi tasgabbii qonnaan bulaaf murteessaadha.',
          en: 'Crucial stability ruling for rural land tenure security and peaceful possession.'
        }
      }
    ]
  },
  {
    volume: 13,
    amharicLabel: 'ቅጽ 13',
    yearEth: '2010',
    yearGreg: '2018',
    publicationYear: 2018,
    title: {
      om: 'Murtiiwwan Dhaddacha Ijibbaataa Jildii 13ffaa (Waliigaltee Bittaa Manaa fi Diiginsa)',
      en: 'Federal Supreme Court Cassation Decisions Volume 13 (House Sale Contracts)'
    },
    theme: {
      om: 'Formality requirements of immovable property contracts and registration under Civil Code Art. 1723.',
      en: 'Formal requirements for immovable sales contracts and validity without official registration.'
    },
    overview: {
      om: 'Jildiin kun waliigaltee bittaa fi gurgurtaa manaa barreeffamaan ta\'uu fi qaama aangoo qabuun galmeeffamuu qabaachuu irratti xiyyeeffata.',
      en: 'This volume details the mandatory legal formalities for house sales and immovable property conveyances.'
    },
    caseCount: 1,
    totalCasesEstimated: 80,
    categories: ['contract', 'commercial'],
    sections: [
      {
        sectionTitle: { om: '1. Waliigaltee Qabeenya Hin Sochoone', en: '1. Immovable Property Contracts' },
        topics: {
          om: ['Galmeessa bittaa manaa', 'Kwt 1723'],
          en: ['House sale registration', 'Civil Code Art. 1723']
        }
      }
    ],
    landmarkCases: [
      {
        fileNumber: '215480',
        category: 'contract',
        title: {
          om: 'Waliigaltee Bittaa fi Gurgurtaa Manaa Barreeffama Malee Raawwatame',
          en: 'Unregistered House Sale Agreement Validity'
        },
        parties: { om: 'Aadde Almaz Tasfaayee vs. Obbo Tamasgeen Dajennee', en: 'Mrs. Almaz Tadesse v. Mr. Tamasgen Dagne' },
        issue: { om: 'Waliigaltee manaa barreeffama afaanii ykn waraqaa qofaatiin raawwatame bu\'aa seeraa qabaa?',
          en: 'Whether oral or unauthenticated house sale agreements confer legal title.'
        },
        keyPrinciple: {
          om: 'Koodii Siiviilii Kwt 1723 fi 2877 bu\'uura godhachuun bittaa manaa barreeffama qaama aangoo qabuun hin mirkanoofne diigamaadha.',
          en: 'Pursuant to Civil Code Arts. 1723 and 2877, contracts transferring immovable property must be in writing and authenticated by authorized administrative organs.'
        },
        statutes: 'Civil Code Arts. 1723, 2877, 2878',
        legalIssue: {
          om: 'Qaamni bittaa raawwate baasii baase gaafachuu ni danda\'aa?',
          en: 'Can a party claim restitution of expenses under failed conveyance?'
        },
        significance: {
          om: 'Sirna gurgurtaa manaa magaalotaa seerarratti akka hundaa\'u taasisa.',
          en: 'Enforces strict formal compliance for urban real estate transactions.'
        }
      }
    ]
  }
];
