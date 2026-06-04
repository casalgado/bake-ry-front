import {
  PhMoney,
  PhDeviceMobile,
  PhCreditCard,
  PhGift,
  PhFile,
} from '@phosphor-icons/vue';
import BancolombiaIcon from '@/assets/icons/bancolombia.svg';
import DaviviendaIcon from '@/assets/icons/outline_davivenda.svg';
import BbvaIcon from '@/assets/icons/bbva.svg';
import NequiIcon from '@/assets/icons/nequi.svg';

export const paymentIconMap = {
  cash: PhMoney,
  transfer: PhDeviceMobile,
  card: PhCreditCard,
  bancolombia: BancolombiaIcon,
  davivienda: DaviviendaIcon,
  bbva: BbvaIcon,
  nequi: NequiIcon,
  complimentary: PhGift,
  quote: PhFile,
};
