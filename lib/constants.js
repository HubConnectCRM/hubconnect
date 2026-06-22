export const INTERACTION_TYPES = [
  "call",
  "email",
  "meeting",
  "message",
  "note",
  "other",
];

export const EVENT_REG_STATUSES = [
  "desiderata",
  "invited",
  "registered",
  "waiting_list",
  "confirmed",
  "declined",
  "attended",
  "no_show",
];

// Badge color per registration status (keys map to <Badge color>).
export const STATUS_COLORS = {
  desiderata: "pink",
  invited: "blue",
  registered: "brand",
  waiting_list: "amber",
  confirmed: "green",
  declined: "red",
  attended: "green",
  no_show: "gray",
};

export const IMPORT_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "job_title",
  "email",
  "phone",
  "company",
  "country",
  "city",
  "source",
  "notes",
];
