# PDF extraction

PDF.js runs in a browser worker served from this application. Files are limited to 4 MB, 20 pages, 200,000 extracted characters and a 20-second processing timeout. Scanned/image-only and encrypted documents are unsupported. Extracted text is untrusted data; there are no instructions, tools, RAG or AI calls driven by its contents.

`parser.ts` returns only PNR, an explicitly labelled customer/passenger phone, passengers, flight segments, warnings, parser ID and a mandatory review-required label. It cannot produce either financial input. On import, the customer defaults to Passenger 1 and the labelled customer/passenger phone. Agency/agent/generic phone labels are ignored. Email always defaults to blank and remains optional. Both customer fields remain editable. The form keeps the original financial values separate, validates submitted fields with Zod, and never creates a booking until the user explicitly submits.

## Adapter order

1. `agency-flight-cards-v1`: Airline PNR, passenger/ticket table, Onward/Return card, explicit airport codes, flight number and operator. Flight-card years come from the corresponding journey heading, never the issued date. Ambiguous arrival years are left blank.
2. `agency-flight-table-v1`: Airline PNR takes precedence over master/supplier references. Wrapped passenger rows are reconstructed. Each table flight row receives its own departure/arrival. Explicit route codes in the itinerary/baggage labels supply airports; unmatched rows produce a warning. Unknown carrier codes stay blank.
3. `labelled-ticket-v1`: conservative explicit labels, ISO local dates and segment blocks. Ambiguous numeric dates remain blank. Missing names, dates and references are flagged.

The carrier code lookup is deliberately short: IX and 6E. References: [Air India Express carrier code](https://www.airindiaexpress.com/tnc), [IndiGo flight number examples](https://www.goindigo.in/information/terminal-change-ta.html). These mappings do not imply a codeshare operator where none is printed; review remains mandatory.

The adapters were informed by three user-provided layouts. The original PDFs are not copied into the repository. The public fixtures use new fictional passenger names, identifiers, dates, routes and amounts.

## Reproduce the measured result

```sh
python scripts/create-fixtures.py
npm run pdf:evaluate
```

Five PDFs yield 64 expected leaf fields, including explicitly absent arrival/ticket values. Each field is compared for exact equality after the parser's defined normalization. The report records per-field correctness and the parser used. This checks real PDF text extraction, not only strings injected into a parser. Dedicated unit tests additionally cover no text, huge text, ambiguous dates, multi-passenger/multi-segment input, and rejection of PDF prices as financial values.

## Limits

PDF text positioning/reading order is not standardized. Different supplier layouts, complex tables, unlabelled names, date formats, codeshares, overnight year changes and repeated route loops need additional fixtures and adapters. A supported-looking format can still be wrong; therefore every import is a review workflow. The original PDF is shown where the browser supports embedded previews. Real files are never retained in the public demo; private retention is an explicit staff choice. This release validates PDF structure/signature/limits but does not run a malware scanner.
