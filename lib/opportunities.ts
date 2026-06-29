// Config for the /opportunities provider hubs and their submission forms.
import type { Opportunity } from "./types";

export type FieldKind = "text" | "number" | "select" | "checkboxes";

export interface ExtraField {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  required?: boolean;
}

export interface OpportunityDef {
  type: Opportunity["type"];
  emoji: string;
  title: string;
  headline: string;
  description: string;
  benefits: string[];
  buttonLabel: string;
  businessLabel: string;
  extra: ExtraField[];
}

export const OPPORTUNITIES: OpportunityDef[] = [
  {
    type: "car_hire",
    emoji: "🚗",
    title: "Car Hire Hub",
    headline: "List your vehicles for event hire",
    description:
      "Offer your cars, buses or SUVs to attendees heading to events. Get booked directly through LinkUpNaija.",
    benefits: [
      "Reach event-goers who need transport",
      "Set your own rates",
      "Get paid via Paystack",
      "Build ratings and reviews",
    ],
    buttonLabel: "Register as Car Hire",
    businessLabel: "Business name",
    extra: [
      {
        key: "vehicle_type",
        label: "Vehicle type",
        kind: "select",
        options: ["Sedan", "SUV", "Bus", "Luxury"],
        required: true,
      },
      { key: "num_vehicles", label: "Number of vehicles", kind: "number" },
    ],
  },
  {
    type: "photographer",
    emoji: "📸",
    title: "Photographer Hub",
    headline: "Get booked for events near you",
    description:
      "Offer photography and videography to event hosts. Let hosts find and book you directly.",
    benefits: [
      "Hosts discover your profile",
      "Set your rates per event",
      "Build a portfolio",
      "Get paid via Paystack",
    ],
    buttonLabel: "Register as Photographer",
    businessLabel: "Stage name",
    extra: [
      {
        key: "services",
        label: "Services",
        kind: "checkboxes",
        options: ["Photography", "Videography", "Live streaming"],
      },
      { key: "portfolio", label: "Instagram / portfolio link", kind: "text" },
    ],
  },
  {
    type: "venue",
    emoji: "🏛️",
    title: "Venue Owner Hub",
    headline: "List your venue and get bookings",
    description:
      "Restaurants, lounges, halls, parks — list your venue and let event hosts book you directly.",
    benefits: [
      "Appear on venue discovery map",
      "Receive reservation requests",
      "Set capacity and pricing",
      "Get featured to thousands",
    ],
    buttonLabel: "List My Venue",
    businessLabel: "Venue name",
    extra: [
      {
        key: "venue_type",
        label: "Venue type",
        kind: "select",
        options: ["Restaurant", "Lounge", "Hall", "Outdoor", "Hotel", "Other"],
        required: true,
      },
      { key: "capacity", label: "Capacity", kind: "number" },
      { key: "address", label: "Address", kind: "text" },
      { key: "website", label: "Instagram / website", kind: "text" },
    ],
  },
];
