# Participants Role Codebook

**Version:** 1.0 — 2026-05-15  
**Decision source:** D20 (codec evolution session)  
**Status:** Complete for 1-byte range; 2-byte extension defined by group  

---

## 1. Wire Format

### 1.1 ROLE_TYPE 3-bit quick-select (part_flags bits 6–4)

Zero extra bytes. Covers the most frequent participant roles in workpads records globally.

| Code | Value | UI Label | Who it means |
|------|-------|----------|--------------|
| `000` | 0 | Customer / Client | Person or org being billed or serviced |
| `001` | 1 | Worker / Tradesperson | The sending worker (often IS_SENDER=1 too) |
| `010` | 2 | Supplier / Vendor | Provides goods or materials to the sender |
| `011` | 3 | Subcontractor | External party doing part of the work |
| `100` | 4 | Employee / Staff | Employed by the sender or the organisation |
| `101` | 5 | Agent / Representative | Acts on behalf of another party |
| `110` | 6 | Authority / Inspector | Regulatory, government, or inspection body |
| `111` | 7 | **Extended** — see role_code below | |

### 1.2 Extended role_code (when ROLE_TYPE = 111)

Follows immediately after the name field (and phone/email if present), in the `role_text` position.

**Decoding rules:**

- `HAS_ROLE_TEXT = 0`: role_code bytes follow (no length prefix)
  - Byte 1 = `0x00`–`0xFE`: 1-byte code (see §2)
  - Byte 1 = `0xFF`: 2-byte code — byte 2 follows (see §3)
- `HAS_ROLE_TEXT = 1`: `[uint16 len][UTF-8]` free-text role label (legacy behavior, always valid)

**Byte layout for 1-byte range:**

```
bits 7-4: group (0–15, 16 groups)
bits 3-0: role within group (0–14 = specific role; 15 = reserved/group-level)
0xFF = 2-byte extension escape
```

---

## 2. One-Byte Role Codes (0x00–0xFE)

### Group 0: Management & Leadership (0x00–0x0F)
| Code | Role | UI label |
|------|------|----------|
| `0x00` | Business Owner / Proprietor | Owner |
| `0x01` | CEO / Managing Director | Director |
| `0x02` | General Manager | Manager |
| `0x03` | Operations Manager | Ops Manager |
| `0x04` | Project Manager | Project Mgr |
| `0x05` | Supervisor | Supervisor |
| `0x06` | Team Lead | Team Lead |
| `0x07` | Coordinator | Coordinator |
| `0x08` | Master Craftsman / Artisan Leader | Master |
| `0x09` | Franchise Owner | Franchisee |
| `0x0A` | Company Director | Director |
| `0x0B` | Partner / Co-owner | Partner |
| `0x0C` | Trustee | Trustee |
| `0x0D` | Board Member | Board |
| `0x0E` | Informal Business Operator | Operator |
| `0x0F` | *(reserved)* | — |

### Group 1: Finance & Money (0x10–0x1F)
| Code | Role | UI label |
|------|------|----------|
| `0x10` | Accountant / Bookkeeper | Accountant |
| `0x11` | Auditor | Auditor |
| `0x12` | Financial Advisor | Fin. Advisor |
| `0x13` | Tax Professional | Tax Agent |
| `0x14` | Loan / Credit Officer | Loan Officer |
| `0x15` | Mobile Money Agent | MMA |
| `0x16` | Money Changer | Exchanger |
| `0x17` | Microfinance Officer | Microfinance |
| `0x18` | Savings Group Treasurer | VSLA Treas. |
| `0x19` | SACCO Officer | SACCO |
| `0x1A` | Insurance Agent / Broker | Insurance |
| `0x1B` | Investment Adviser | Investment |
| `0x1C` | Treasurer | Treasurer |
| `0x1D` | Payroll Officer | Payroll |
| `0x1E` | Billing / Revenue Officer | Billing |
| `0x1F` | *(reserved)* | — |

### Group 2: Legal & Compliance (0x20–0x2F)
| Code | Role | UI label |
|------|------|----------|
| `0x20` | Lawyer / Attorney | Lawyer |
| `0x21` | Legal Consultant | Legal Consult |
| `0x22` | Paralegal | Paralegal |
| `0x23` | Notary Public | Notary |
| `0x24` | Company Secretary | Co. Secretary |
| `0x25` | Compliance Officer | Compliance |
| `0x26` | Contract Administrator | Contracts |
| `0x27` | Mediator / Dispute Resolver | Mediator |
| `0x28` | Arbitrator | Arbitrator |
| `0x29` | Intellectual Property Specialist | IP |
| `0x2A` | Legal Aid Worker | Legal Aid |
| `0x2B` | Land / Property Rights Officer | Land Rights |
| `0x2C` | Debt Collector | Debt Coll. |
| `0x2D` | Estate Administrator | Estate Admin |
| `0x2E` | Community Elder (dispute) | Elder |
| `0x2F` | *(reserved)* | — |

### Group 3: Professional Services & Advisory (0x30–0x3F)
| Code | Role | UI label |
|------|------|----------|
| `0x30` | Management Consultant | Mgmt Consult |
| `0x31` | Business Consultant | Biz Consult |
| `0x32` | HR Consultant | HR Consult |
| `0x33` | Marketing Consultant | Marketing |
| `0x34` | Technical Advisor | Tech Advisor |
| `0x35` | Quality Assurance Inspector | QA |
| `0x36` | Environmental Consultant | Env. Consult |
| `0x37` | Safety / HSSE Officer | Safety |
| `0x38` | Research Analyst | Researcher |
| `0x39` | Data Analyst / Scientist | Data Analyst |
| `0x3A` | Land Surveyor | Surveyor |
| `0x3B` | Valuer / Property Appraiser | Valuer |
| `0x3C` | Interpreter / Translator | Translator |
| `0x3D` | Public Relations Officer | PR |
| `0x3E` | Social Media Specialist | Social Media |
| `0x3F` | *(reserved)* | — |

### Group 4: Healthcare & Wellness (0x40–0x4F)
| Code | Role | UI label |
|------|------|----------|
| `0x40` | Doctor / Physician | Doctor |
| `0x41` | Nurse / Registered Nurse | Nurse |
| `0x42` | Midwife | Midwife |
| `0x43` | Pharmacist | Pharmacist |
| `0x44` | Community Health Worker | CHW |
| `0x45` | Traditional Healer | Trad. Healer |
| `0x46` | Lab Technician | Lab Tech |
| `0x47` | Dentist | Dentist |
| `0x48` | Medical Assistant | Med. Asst |
| `0x49` | Physiotherapist | Physio |
| `0x4A` | Optician / Optometrist | Optician |
| `0x4B` | Psychologist / Counsellor | Counsellor |
| `0x4C` | Public Health Officer | Public Health |
| `0x4D` | Nutritionist / Dietitian | Nutritionist |
| `0x4E` | Emergency / Paramedic | Paramedic |
| `0x4F` | *(reserved)* | — |

### Group 5: Construction & Building Trades (0x50–0x5F)
| Code | Role | UI label |
|------|------|----------|
| `0x50` | General Contractor | Contractor |
| `0x51` | Electrician | Electrician |
| `0x52` | Plumber | Plumber |
| `0x53` | Carpenter | Carpenter |
| `0x54` | Mason / Bricklayer | Mason |
| `0x55` | Painter / Decorator | Painter |
| `0x56` | Welder | Welder |
| `0x57` | HVAC Technician | HVAC |
| `0x58` | Tiler | Tiler |
| `0x59` | Roofer | Roofer |
| `0x5A` | Architect | Architect |
| `0x5B` | Civil / Structural Engineer | Engineer |
| `0x5C` | Site Supervisor | Site Sup. |
| `0x5D` | Equipment Operator | Equip. Op. |
| `0x5E` | General Labourer | Labourer |
| `0x5F` | *(reserved)* | — |

### Group 6: Agriculture & Farming (0x60–0x6F)
| Code | Role | UI label |
|------|------|----------|
| `0x60` | Farmer / Smallholder | Farmer |
| `0x61` | Agricultural Extension Officer | Agri. Officer |
| `0x62` | Veterinarian | Vet |
| `0x63` | Agronomist | Agronomist |
| `0x64` | Farm Manager | Farm Mgr |
| `0x65` | Agricultural Co-op Manager | Co-op Mgr |
| `0x66` | Livestock Herder / Pastoralist | Herder |
| `0x67` | Farm Labourer | Farm Labour |
| `0x68` | Horticulturist / Horticulture | Horticulture |
| `0x69` | Fisherman / Fishing Technician | Fisher |
| `0x6A` | Forestry Officer | Forestry |
| `0x6B` | Irrigation Specialist | Irrigation |
| `0x6C` | Soil Scientist | Soil Sci. |
| `0x6D` | Crop Inspector / Grading Officer | Crop Insp. |
| `0x6E` | Beekeeper | Beekeeper |
| `0x6F` | *(reserved)* | — |

### Group 7: Transport & Logistics (0x70–0x7F)
| Code | Role | UI label |
|------|------|----------|
| `0x70` | Truck / Long-Distance Driver | Driver |
| `0x71` | Bus / Minibus Driver | Bus Driver |
| `0x72` | Taxi Driver | Taxi |
| `0x73` | Motorbike Taxi (Okada / Boda Boda) | Moto Taxi |
| `0x74` | Delivery Driver / Courier | Delivery |
| `0x75` | Logistics Manager | Logistics Mgr |
| `0x76` | Warehouse Manager | Warehouse |
| `0x77` | Dispatcher | Dispatcher |
| `0x78` | Vehicle Mechanic | Mechanic |
| `0x79` | Freight Forwarder | Freight |
| `0x7A` | Port / Dock Worker | Port Worker |
| `0x7B` | Loader / Cargo Handler | Cargo |
| `0x7C` | Conductor / Ticket Seller | Conductor |
| `0x7D` | Customs Broker | Customs |
| `0x7E` | Shipping Agent | Shipping |
| `0x7F` | *(reserved)* | — |

### Group 8: Retail & Commerce (0x80–0x8F)
| Code | Role | UI label |
|------|------|----------|
| `0x80` | Shop / Store Manager | Shop Mgr |
| `0x81` | Sales Associate | Sales |
| `0x82` | Cashier | Cashier |
| `0x83` | Wholesaler | Wholesaler |
| `0x84` | Distributor | Distributor |
| `0x85` | Market Trader / Vendor | Trader |
| `0x86` | Street Hawker / Roaming Vendor | Hawker |
| `0x87` | Kiosk Operator | Kiosk |
| `0x88` | Retailer | Retailer |
| `0x89` | Import / Export Trader | Importer |
| `0x8A` | Informal Cross-Border Trader | Cross-Border |
| `0x8B` | Auctioneer | Auctioneer |
| `0x8C` | Merchandise Supervisor | Merch. Sup. |
| `0x8D` | Inventory Manager | Inventory |
| `0x8E` | Sales Representative | Sales Rep |
| `0x8F` | *(reserved)* | — |

### Group 9: Personal & Domestic Services (0x90–0x9F)
| Code | Role | UI label |
|------|------|----------|
| `0x90` | Hairdresser / Barber / Cosmetologist | Barber |
| `0x91` | Tailor / Dressmaker | Tailor |
| `0x92` | Cleaner / Housekeeper | Cleaner |
| `0x93` | Cook / Chef | Cook |
| `0x94` | Nanny / Childcare Provider | Nanny |
| `0x95` | Elderly Care Worker | Care Worker |
| `0x96` | Shoemaker / Shoe Repairer | Cobbler |
| `0x97` | Laundry Worker | Laundry |
| `0x98` | Waiter / Server | Waiter |
| `0x99` | Personal Assistant | PA |
| `0x9A` | Gardener / Landscaper | Gardener |
| `0x9B` | Pest Control Technician | Pest Control |
| `0x9C` | Catering Manager | Caterer |
| `0x9D` | Event Planner | Events |
| `0x9E` | Restaurant Manager | Rest. Mgr |
| `0x9F` | *(reserved)* | — |

### Group A: Technology & Digital (0xA0–0xAF)
| Code | Role | UI label |
|------|------|----------|
| `0xA0` | Software Developer / Programmer | Developer |
| `0xA1` | IT Support / Help Desk | IT Support |
| `0xA2` | Network / Systems Engineer | Sys. Eng. |
| `0xA3` | Data Analyst / Scientist | Data |
| `0xA4` | Web Developer | Web Dev |
| `0xA5` | IT Manager | IT Manager |
| `0xA6` | Cybersecurity Specialist | Security |
| `0xA7` | Mobile Phone Repairer | Phone Tech |
| `0xA8` | Computer Repair Technician | PC Tech |
| `0xA9` | Solar / Renewable Energy Tech | Solar Tech |
| `0xAA` | Database Administrator | DBA |
| `0xAB` | Digital Skills Trainer | Digital Train |
| `0xAC` | Telecoms Field Technician | Telecoms |
| `0xAD` | CCTV / Security Systems | CCTV |
| `0xAE` | Electronics Repairer | Electronics |
| `0xAF` | *(reserved)* | — |

### Group B: Manufacturing & Industrial (0xB0–0xBF)
| Code | Role | UI label |
|------|------|----------|
| `0xB0` | Production / Factory Manager | Production |
| `0xB1` | Factory / Assembly Worker | Factory |
| `0xB2` | Quality Control Inspector | QC |
| `0xB3` | Machine Operator | Machine Op. |
| `0xB4` | Maintenance Technician | Maintenance |
| `0xB5` | Industrial Electrician | Ind. Elec. |
| `0xB6` | Artisanal / Small-Scale Miner | Miner |
| `0xB7` | Mining Engineer | Mining Eng. |
| `0xB8` | Oil / Gas / Extractive Worker | Oil & Gas |
| `0xB9` | Textile Worker / Weaver | Textile |
| `0xBA` | Craft Artisan (general) | Artisan |
| `0xBB` | Furniture Maker | Furniture |
| `0xBC` | Metalwork Artisan / Blacksmith | Metalwork |
| `0xBD` | Pottery / Ceramics Maker | Potter |
| `0xBE` | Production Supervisor | Prod. Sup. |
| `0xBF` | *(reserved)* | — |

### Group C: Government & Public Sector (0xC0–0xCF)
| Code | Role | UI label |
|------|------|----------|
| `0xC0` | Government Official | Govt Official |
| `0xC1` | Tax / Revenue Officer | Tax Officer |
| `0xC2` | Customs / Immigration Officer | Customs |
| `0xC3` | Health / Sanitation Inspector | Inspector |
| `0xC4` | Labour / Employment Officer | Labour |
| `0xC5` | Licence / Permit Officer | Licensing |
| `0xC6` | Police / Law Enforcement | Police |
| `0xC7` | Community Development Officer | Community Dev |
| `0xC8` | Social Welfare Officer | Welfare |
| `0xC9` | Census / Survey Enumerator | Enumerator |
| `0xCA` | Administrative Clerk | Clerk |
| `0xCB` | Village Chief / Traditional Authority | Chief |
| `0xCC` | Ward Councillor / Elected Rep | Councillor |
| `0xCD` | Court Official / Registrar | Court |
| `0xCE` | Environmental / Park / Forest Ranger | Ranger |
| `0xCF` | *(reserved)* | — |

### Group D: Education & Training (0xD0–0xDF)
| Code | Role | UI label |
|------|------|----------|
| `0xD0` | Teacher / Instructor | Teacher |
| `0xD1` | Trainer / Facilitator | Trainer |
| `0xD2` | Tutor | Tutor |
| `0xD3` | School / College Administrator | Edu Admin |
| `0xD4` | Curriculum Developer | Curriculum |
| `0xD5` | Vocational Trainer | Voc. Trainer |
| `0xD6` | Apprenticeship Master | Apprentice M. |
| `0xD7` | Community Educator | Comm. Edu |
| `0xD8` | Adult Literacy Teacher | Literacy |
| `0xD9` | Sports Coach | Coach |
| `0xDA` | University Lecturer | Lecturer |
| `0xDB` | Educational Coordinator | Edu Coord. |
| `0xDC` | Skills Development Officer | Skills Dev |
| `0xDD` | Research Assistant | Res. Asst |
| `0xDE` | Library / Archive Officer | Librarian |
| `0xDF` | *(reserved)* | — |

### Group E: Community, Development & Social (0xE0–0xEF)
| Code | Role | UI label |
|------|------|----------|
| `0xE0` | NGO / Development Project Officer | NGO |
| `0xE1` | Community Health Volunteer | CHV |
| `0xE2` | Community Volunteer | Volunteer |
| `0xE3` | Social Worker / Case Manager | Social Worker |
| `0xE4` | Youth / Children Worker | Youth Worker |
| `0xE5` | Development Field Worker | Dev. Worker |
| `0xE6` | Peer Educator | Peer Edu |
| `0xE7` | Social Mobilizer | Mobilizer |
| `0xE8` | Cooperative / Group Leader | Co-op Leader |
| `0xE9` | Religious Leader / Clergy | Clergy |
| `0xEA` | Journalist / Reporter | Journalist |
| `0xEB` | Photographer / Videographer | Photographer |
| `0xEC` | Security Guard / Watchman | Guard |
| `0xED` | Real Estate / Property Agent | Property |
| `0xEE` | Waste Picker / Informal Recycler | Waste |
| `0xEF` | *(reserved)* | — |

### Group F: Specialized & Other (0xF0–0xFE)
| Code | Role | UI label |
|------|------|----------|
| `0xF0` | Scientist / Researcher | Scientist |
| `0xF1` | Engineer (general, unlisted) | Engineer |
| `0xF2` | Urban Planner | Planner |
| `0xF3` | Jeweller / Goldsmith | Jeweller |
| `0xF4` | Tinsmith / Sheet Metal Worker | Tinsmith |
| `0xF5` | Stone Mason (decorative) | Stone Mason |
| `0xF6` | Upholsterer | Upholsterer |
| `0xF7` | Florist | Florist |
| `0xF8` | Funeral Services Provider | Funeral |
| `0xF9` | Printer / Signmaker | Printer |
| `0xFA` | Traditional Birth Attendant | TBA |
| `0xFB` | Formal Waste / Sanitation Worker | Sanitation |
| `0xFC` | Charity / Religious Org. (inst.) | Charity |
| `0xFD` | Certified Professional (unlisted) | Professional |
| `0xFE` | Other — free text follows | Other |
| `0xFF` | **2-byte extension (see §3)** | — |

---

## 3. Two-Byte Extended Codes (0xFF prefix)

When byte 1 = `0xFF`, byte 2 selects from the extended range. Groups align with 1-byte groups where more specific roles are needed.

| 2nd byte range | Group | Description |
|----------------|-------|-------------|
| `0x00`–`0x0F` | Extended Finance | Banker, fund manager, actuary, broker-dealer, forex trader, pensions officer, stockbroker, microinsurance, credit analyst, venture capitalist, private equity, leasing officer, stokvel/tontine manager |
| `0x10`–`0x1F` | Extended Healthcare | Surgeon, specialist physician, radiographer, occupational therapist, speech therapist, audiologist, ayurvedic/TCM practitioner, herbalist/plant medicine, home-based care, birth doula, village health volunteer |
| `0x20`–`0x2F` | Extended Legal | Magistrate/judge, immigration lawyer, human rights advocate, environmental law, corporate counsel, conveyancer, trademark agent, patent attorney, bailiff, process server |
| `0x30`–`0x3F` | Extended Technology | AI/ML engineer, blockchain developer, IoT specialist, drone operator, 3D printing technician, satellite technician, radio engineer, digital forensics |
| `0x40`–`0x4F` | Extended Agriculture | Aquaculture specialist, seed technician, organic certification officer, greenhouse operator, post-harvest specialist, irrigation engineer, food safety inspector, agroforestry officer |
| `0x50`–`0x5F` | Extended Transport | Airline pilot, marine captain, port logistics manager, rail operator, crane operator, forklift driver, aviation ground crew, fuel tanker driver |
| `0x60`–`0x6F` | Extended Energy & Utilities | Electricity engineer, water treatment operator, gas technician, renewable energy installer, grid technician, metering inspector, fuel distributor |
| `0x70`–`0x7F` | Extended Construction | Scaffolding specialist, glass worker, waterproofer, asbestos removal, demolition contractor, geotechnical engineer, fire safety engineer, quantity surveyor |
| `0x80`–`0x8F` | Media & Entertainment | Film director, actor/performer, musician, audio engineer, radio presenter, TV producer, graphic designer, animator, game developer, content creator |
| `0x90`–`0x9F` | Sports & Recreation | Athlete, coach (professional), sports manager, referee/umpire, fitness trainer, recreation officer, park warden, swimming instructor |
| `0xA0`–`0xAF` | Military & Security | Military officer, soldier, intelligence officer, coast guard, fire officer, pararescue, explosive ordnance, private military contractor |
| `0xB0`–`0xBF` | Diplomatic & International | Diplomat, UN/INGO officer, embassy official, trade attaché, cultural officer, development economist, international arbitrator |
| `0xC0`–`0xCF` | Domestic & Family | Spouse/partner (co-signer), family guarantor, dependent adult, personal carer (family), homemaker, household manager |
| `0xD0`–`0xDF` | Religious & Cultural | Imam, pastor/priest, rabbi, traditional spiritual leader, cultural heritage officer, museum curator, archaeologist |
| `0xE0`–`0xEF` | Research & Academia | Professor, postdoctoral researcher, clinical trials officer, epidemiologist, social scientist, statistician, academic administrator |
| `0xF0`–`0xFD` | Reserved for future groups | — |
| `0xFE` | Other extended (free text follows) | Other |
| `0xFF` | **3-byte extension** (future/ultra-specialized) | — |

---

## 4. Encoding Decision (D20)

**Decision:** ROLE_TYPE 3-bit quick-select retained. Extended role_code uses escape-code scheme.

```
part_flags ROLE_TYPE=111 (extended):
  HAS_ROLE_TEXT=0:
    role_code byte 1 = 0x00–0xFE  → 1-byte code (§2)
    role_code byte 1 = 0xFF        → read byte 2 for 2-byte code (§3)
  HAS_ROLE_TEXT=1:
    [uint16 len][UTF-8] free text label — always valid fallback
```

**Capacity:**
- 7 zero-byte super-category codes (ROLE_TYPE 0–6)
- 1-byte range: 240 specific named roles + 16 group-level slots
- 2-byte range: ~224 additional specialist/regional roles
- 3-byte: future extension only (0xFF 0xFF prefix)
- Free text: always available via HAS_ROLE_TEXT=1

---

## 5. ROLE_TYPE Super-Categories vs 1-Byte Codes

The 3-bit quick-select maps to 1-byte code groups as follows. Encoders using a 1-byte role_code should use ROLE_TYPE=7 (extended) even when the role falls under a quick-select group — the code is more specific.

| ROLE_TYPE | Equivalent extended groups |
|-----------|---------------------------|
| 000 Customer | Group 8 (retail) client roles; no direct group overlap |
| 001 Worker | Group 5 (construction), Group 7 (transport), Group 9 (personal service) |
| 010 Supplier | Group 8 (retail/commerce), Group B (manufacturing) |
| 011 Subcontractor | Group 5 (construction), Group 3 (professional services) |
| 100 Employee | Group 0 (management), any group for employed roles |
| 101 Agent | Group 1 (finance agent), Group 8 (sales rep), Group 3 |
| 110 Authority | Group C (government/public sector) |

---

## 6. UI Display Notes

- **Quick-select (ROLE_TYPE 0–6):** Shown as 7 tap-targets on the participants screen. Works without any app update or codebook download.
- **1-byte role_code:** Displayed from the built-in codebook. App ships with Group 0–F label strings in the codebook package.
- **2-byte role_code:** App displays the group name + role name from codebook. Unknown codes fall back to the group name.
- **Free text (HAS_ROLE_TEXT=1):** Displayed as typed. Stored as UTF-8 in the record.
- **IS_ORG=1:** UI prefixes role with "Company:" or "Org:" as appropriate (e.g. "Company: Supplier").

---

## 7. Coverage Notes

This codebook covers roles found in:
- ISCO-08 international standard (ILO, UN) — all major and minor groups
- African informal economy: mobile money agents, market traders, okada/boda boda drivers, artisans, VSLAs, waste pickers, community health volunteers
- Gig economy: delivery drivers, digital freelancers, ride-share, platform workers
- Global South specifics: traditional healers, TBAs, livestock herders, subsistence farmers, extension officers, sanitation workers
- Field service trades: electricians, plumbers, carpenters, masons, welders, HVAC, tilers, painters
- Financial services: formal and informal, including microfinance, SACCO, stokvel/tontine
- Healthcare: formal, community-based, and traditional medicine globally
- Agriculture: subsistence to commercial, including co-operatives and extension services

Expected coverage: >99% of all real-world workpads participant roles without requiring free text.
