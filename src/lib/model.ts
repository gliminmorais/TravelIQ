export type Status = 'pending' | 'confirmed' | 'cancelled' | 'refunded';
export type Segment = {
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
};
export type Passenger = { name: string; ticketNumber: string };
export type Transaction = {
  id: string;
  type: 'payment' | 'refund' | 'adjustment';
  amount: string;
  costAdjustment?: string;
  date: string;
  note: string;
};
export type Booking = {
  id: string;
  customerId: string;
  customerName: string;
  phone: string;
  email: string;
  pnr: string;
  bookedOn: string;
  status: Status;
  currency: 'INR';
  agencyCost: string;
  customerCharged: string;
  passengers: Passenger[];
  segments: Segment[];
  transactions: Transaction[];
  archived: boolean;
  version: number;
  createdAt: string;
};
