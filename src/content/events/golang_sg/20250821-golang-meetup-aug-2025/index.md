---
org: "golang_sg"
title: "Golang Meetup - Aug 2025"
description: "DetailsHello Gophers! Announcing our meetup for August 2025! foodpanda will be hosting us at their space. A big thank you to them for sponsoring the venue! Plea"
venue: "foodpanda"
venueAddress: "63 Robinson Road, Afro-Asia building · Singapore"
startDate: "2025-08-21"
startTime: "19:00"
endTime: "21:00"
heroImage: "hero-1755009010095.jpeg"
tags: ["Events in Singapore", "SG", "Golang", "Open Source", "Programming Languages", "Software Development", "Web Technology"]
rsvpButtonUrl: "https://www.meetup.com/golangsg/events/310309131"
rsvpButtonText: "RSVP on Meetup"
---

## Details

Hello Gophers!

Announcing our meetup for August 2025! foodpanda will be hosting us at their space. A big thank you to them for sponsoring the venue! Please provide your details in the fields when signing up, so that we can register you for security.

We're always looking for speakers. If you'd like to speak at upcoming meetups, please submit your talk here: [https://forms.gle/oNCwH6SY8jJUWg7cA](https://forms.gle/oNCwH6SY8jJUWg7cA)

**Event Agenda:**  
7:00pm - 7:15pm: Arrive at venue, chat, network  
📢 Working with Go's test cache on CI  
🎤 Björn Andersson - Principal Engineer, foodpanda  
Do you know what you can cache test results on CI so you don't have to re-run tests for code that hasn't changed between CI runs? Are you also aware that this could mean black box integration tests that depend on running services can get cached because Go doesn't know they call other services, and therefore you might have a false-positive and let buggy code out? This is a walkthrough of how Go's build cache works for tests. I'll show you how to design your test suite to benefit from caching and make sure your tests that _absolutely cannot_ be cached aren't.

Björn is a principal engineer at foodpanda where he spends his days figuring out how to get into production faster and how to get production back up again when it goes wrong (because it always does…). Always ends up harping on about testing one way or another…

📢 Go embedding tips for high performance applications  
🎤 Loh SiuYin  
Go like C allows embedding libraries. Specifically there is the embed capability in Go's standard library. Additionally I have found embedding NATS to be particularly useful. Think message streaming, key-value and object store capability in one Go binary complete with a web frontend.

SiuYin is a long time Go developer, since version 1.0