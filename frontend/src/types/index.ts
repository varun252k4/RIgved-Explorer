export interface Verse {
  text: string;
  mandala: number;
  sukta: number;
  rik: number;
}

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

export interface NavbarState {
  scrolled: boolean;
}