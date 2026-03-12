export interface SignatureDetail {
  page: number;
  rectangle: string;
}

export interface DocumentTemplate {
  [roleOrDetail: string]: SignatureDetail | any;
}

export const SIGNATURE_TEMPLATES: { [docType: string]: DocumentTemplate } = {
  HSH_HĐKXĐ: {
    BEN_A: {
      page: 4,
      rectangle: '333,380,492,475',
    },
    BEN_B: {
      page: 4,
      rectangle: '121,378,263,475',
    },
  },
  HSH_HĐTV: {
    BEN_A: {
      page: 3,
      rectangle: '328, 540, 510, 620',
    },
    BEN_B: {
      page: 3,
      rectangle: '110, 540, 250, 620',
    },
  },
  HSH_HĐCTV: {
    BEN_A: {
      page: 5,
      rectangle: '367,557,513,640',
    },
    BEN_B: {
      page: 5,
      rectangle: '146,557,290,640',
    },
  },
  HSH_HĐĐTN: {
    BEN_A: {
      page: 2,
      rectangle: '349,105,516,195',
    },
    BEN_B: {
      page: 2,
      rectangle: '124,105,260,195',
    },
  },
  HSH_HĐXĐ: {
    BEN_A: {
      page: 4,
      rectangle: '332,376,494,466',
    },
    BEN_B: {
      page: 4,
      rectangle: '108,376,271,466',
    },
  },
  HSH_BBTTCV: {
    BEN_A: {
      page: 2,
      rectangle: '375,265,536,355',
    },
    BEN_B: {
      page: 2,
      rectangle: '128,265,260,355',
    },
  },
};
