# Vision — Workpads

## 1. The Individual Business Record

A workpad is proof. It says: *I was here. I did this work. Here is what happened.*

For the field worker — the electrician, the plumber, the courier, the repair agent, the surveyor, the contractor — the business record is not an administrative convenience. It is the documentation of their labour and the foundation of their payment. Without it, work can be disputed, underpaid, forgotten. With it, the worker has evidence, the customer has a receipt, and the relationship has a basis in fact.

Workpads exists to make that record easy to create, own, and share — from any device, in any condition, in any country.

---

## 2. Who Workpads Is For

Workpads is built for the individual who works in the field and needs to document what they did.

They often use a feature phone — not because they can't afford more, but because a feature phone survives a building site, lasts three days on a charge, and fits in a pocket. They often work in intermittent connectivity — jobs happen in basements, in rural areas, in places where the network is slow or absent. They always need to share the record quickly — with a customer standing in front of them, with a manager on the other end of an SMS, with an employer who needs proof before they pay.

The tool must work for this person. That means: no signup. No subscription. No server dependency. No data plan requirement at the point of use.

---

## 3. Device Sovereignty

All data lives in `localStorage` on the device. The device is the worker's. The data is the worker's.

There is no account to create, no cloud to sync to, no terms of service that grant a company rights to the worker's records. A Workpads record cannot be taken away by a platform shutdown, a subscription lapse, or a policy change.

Sharing is done by URL — the record is encoded into a compact payload that travels as a link. The URL *is* the document. The recipient doesn't need the same app, doesn't need an account, doesn't need to be connected when they receive it. The record is self-contained.

This is device sovereignty: the record lives where the worker lives.

---

## 4. The PADS Model

Every Workpads record is structured around four sections: **Process**, **Actions**, **Details**, **Story**.

This is not a form designed by a software company. It is a shape that matches how field work actually unfolds: what kind of job is it and for whom (Process); what specific steps were taken (Actions); the operational particulars — location, timing, who was there (Details); the narrative account of what happened (Story).

PADS is universal. A boiler repair, a parcel delivery, a building inspection, a legal consultation, a street vendor's sale — all fit this shape. The field labels change per template; the structure remains constant. This universality is what makes the bitpad wire format compact: the same 11 scalar fields plus an action list can describe any field service record in any industry in any country.

---

## 5. Global Ambition

The codebook-c wire format is compact enough to send as an SMS. A Nokia feature phone in Lagos and an iPhone in London exchange the same workpad — with full template identity, locale, geo coordinates, and participant data intact. The receiver page at `workpads.me/p` works on any browser, with no app required.

Language, network, and device are not barriers to sharing a record. Regional template packs mean that a delivery note created in Nigeria uses Nigerian field labels, Naira, and 7.5% VAT — while the same wire format is decoded correctly in Ghana, Kenya, South Africa, or the UK.

The goal is 100 template types covering the most common field service document types, regional packs for the countries where field workers need this most, and an ecosystem where SIMBA-connected services can extend the record without replacing it.

---

## 6. BASICS Alignment

Workpads is a BASICS-conformant application. BASICS (Business Application Software Infrastructure for Civilizational Scale) is a protocol for building tools that serve real individual economic participation — tools that work on constrained hardware, respect data sovereignty, use compact portable formats, and are designed for the billions of people who conduct economic activity outside the large-platform internet.

Workpads implements the BASICS core tier: offline-first, localStorage, bitpad binary encoding, zero external dependencies at runtime. Every design decision — ES5 JavaScript, no build step, no server calls, compact wire format — is an expression of the BASICS principle that the tool must work for everyone, not just for people with good hardware and fast connections.

---

## 7. SIMBA: The Services Layer

SIMBA (Services Integration for Mobile Business Applications) is the standard for connecting external and on-device services into BASICS-conformant applications without transferring data ownership.

In Workpads, the `service_ref` field in the codebook-c wire format carries the identity of any service that enriched a record — a weather API called at the time of a site visit, a price list lookup, a government registration check, a logistics tracking update. The service identity travels with the record so every receiving client knows its provenance.

Services enrich records. They do not own them. The worker's record carries the service's contribution, but the record remains the worker's — stored on their device, shared on their terms, interpretable without the service being present.

---

## 8. The Record as Infrastructure

Codebook-c, combined with a library of 100+ template types, regional packs for every major market, Activity-level locale (so a worker's business context travels with every record they create), and SIMBA service integration, makes the individual business record into infrastructure.

Not software infrastructure. Economic infrastructure.

A workpad is a primitive unit of economic identity. It says who did what, for whom, where, when, for how much, verified by whom. That primitive, encoded in a format small enough to travel by SMS, readable on any device, owned by the worker who created it — is a tool with the potential to document and protect the economic activity of hundreds of millions of people who currently have no way to create that kind of record at all.

That is the long journey. That is what we are building.
