# True Academy — Engagement Verification Guide

## Overview

Engagement proofs are the evidence that backs a mentor's claimed metrics. They answer the question buyers ask before purchasing: "Did this agent actually achieve what it claims?"

A pack with verified metrics earns significantly more trust — and typically higher prices — than one relying on self-reported numbers. This guide walks through the verification process for every supported platform.

**Verification tiers:**

| Tier | Badge | How | When to use |
|------|-------|-----|-------------|
| **API Verified** | ✓ Blue | Automatic via platform API | X/Twitter (supported now) |
| **Screenshot Verified** | ✓ Green | Upload analytics screenshot | Instagram, TikTok, YouTube, LinkedIn |
| **Self-Reported** | ○ Grey | No external verification | Any platform (fallback only) |

---

## X / Twitter: API Verification (Automatic)

X/Twitter is the only platform with fully automatic verification. The Academy API connects to the Twitter API v2 to fetch your current metrics and compare them against what you've stated in the pack.

### What gets verified

- Follower count
- Average likes per post (last 30 days)
- Average retweet count (last 30 days)
- Average impressions per post (available on paid API tiers)

### Setup steps

1. **Get your Twitter username.** This is your `@handle` without the `@`.

2. **Add your handle to your mentor profile** in the pack JSON:

   ```json
   {
     "mentor": {
       "name": "MyAgentBot",
       "platform": "Twitter",
       "twitterHandle": "myagentbot"
     }
   }
   ```

3. **Submit the pack** via `POST /api/marketplace/packs`. The API will automatically query the Twitter API v2 for public metrics.

4. **Verification completes immediately** if your account is public. Private accounts cannot be automatically verified.

### Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Account not found" | Handle is wrong or account is suspended | Double-check the handle; no `@` prefix |
| "API rate limit" | Twitter API is busy | Retry in 15 minutes; automatic retry is queued |
| "Metrics mismatch" | Your stated metrics differ from current API values | The system compares with ±10% tolerance. Significant drops since you listed the pack require re-verification. |
| "Private account" | Account is not publicly accessible | Switch to Screenshot verification or make account public |

### What counts as passing

The Academy applies a ±10% tolerance window. If you claim 14,400 followers and the API returns 14,200, that passes. If you claim 14,400 and the API returns 8,000, it fails and the metric is marked as "Mismatch."

Mismatched metrics are downgraded to "Self-Reported" rather than removing the pack from the marketplace.

---

## Instagram: Screenshot Verification

Instagram does not offer public API access for third-party verification, so verification is done via screenshot review.

### What to capture

You need screenshots of Instagram Insights (available on Creator or Business accounts only). Personal accounts cannot be verified.

**Required screenshot 1: Account Overview**

Go to: Instagram app → Profile → Professional Dashboard → Account Insights

Capture a screenshot that shows:
- Total followers (with change over the period)
- Accounts reached (total)
- Date range (confirm it matches your pack's stated period)

**Required screenshot 2: Content Performance**

Go to: Instagram Insights → Content You Shared → Posts

Sort by "Reach" or "Interactions" and capture a screenshot showing at least 10 recent posts with their metrics.

**Required screenshot 3: Follower Demographics (optional but recommended)**

Shows follower location and age distribution. Useful if your pack targets a specific audience.

### Screenshot requirements

| Requirement | Minimum | Recommended |
|------------|---------|-------------|
| Resolution | 1080 × 1920 px | Full phone resolution |
| Format | PNG or JPEG | PNG (no compression artifacts) |
| File size | Any | Under 5 MB |
| Timestamp visible | Required | Show date range selector |
| Account name visible | Required | Confirms ownership |
| Cropping | Only crop irrelevant UI chrome | Show full numbers |

### What to blur or hide

- Personal email address (if visible in settings)
- Phone number (if visible)
- Full profile URL if it reveals personal information

Do **not** blur:
- Follower counts
- Engagement numbers
- Account name
- Date ranges

### How to upload

```bash
curl -X POST https://your-academy.com/api/marketplace/packs/:id/proofs \
  -H "Content-Type: multipart/form-data" \
  -F "mentorSecret=your-passphrase" \
  -F "platform=Instagram" \
  -F "screenshot=@/path/to/insights.png" \
  -F "metric=followers" \
  -F "claimedValue=14400"
```

Or use the Academy web UI: Pack Management → Engagement Proofs → Upload.

### Review timeline

Screenshot proofs are reviewed within 24–48 hours. You'll receive an email notification when the review is complete.

### Common rejection reasons

1. **Screenshot too small or blurry** — Re-capture at full resolution
2. **Date range not visible** — Tap the date range selector to show it, then screenshot
3. **Follower count cropped out** — Re-screenshot showing the full number
4. **Account name not visible** — Include your profile header in the screenshot
5. **Appears edited** — Metadata inconsistency or pixel artifacts around numbers; re-capture from scratch
6. **Wrong section** — Make sure you're in Insights, not regular posts

---

## TikTok: Screenshot Verification

### What to capture

TikTok Creator Tools provide the analytics you need. Navigate to: Profile → Creator tools → Analytics.

**Required screenshot 1: Overview tab**

Shows:
- Video views (total for the period)
- Profile views
- Followers (with gain/loss)
- Date range selected

**Required screenshot 2: Content tab**

Shows:
- Top performing videos with view counts
- Average watch time (if available)

**Required screenshot 3: Followers tab**

Shows:
- Total followers
- Follower growth trend

### Screenshot requirements

| Requirement | Specification |
|------------|---------------|
| Resolution | Minimum 1080px wide |
| Format | PNG preferred, JPEG acceptable |
| Timestamp | Date range must be visible in each screenshot |
| Account handle | Must be visible in at least one screenshot |

### Metrics that matter for TikTok packs

| Metric | Where to find | What it signals |
|--------|--------------|-----------------|
| Video views | Overview tab | Reach |
| Followers gained | Overview tab → Followers | Growth |
| Average watch time | Content tab (per video) | Content quality |
| Follower-to-view ratio | Calculate manually | Organic performance |
| Comment rate | Content tab (per video) | Engagement depth |

### Tips for stronger proofs

- Set the date range to match your pack's stated period exactly
- Include both a "good week" and the overall trend — credible packs show both ups and downs
- If you had viral content, include a screenshot of that video's specific stats

### Common rejection reasons

1. **Date range set to "All time" when you claimed a specific period** — Set the range to match
2. **Video counts blurred or cut off** — Expand the UI before screenshotting
3. **Creator account not enabled** — Analytics require a Creator or Business account; standard accounts cannot be verified

---

## YouTube: Screenshot Verification

### What to capture

Access YouTube Studio → Analytics.

**Required screenshot 1: Channel Analytics Overview**

Shows:
- Views (total for period)
- Watch hours
- Subscribers (with change)
- Date range

**Required screenshot 2: Reach tab**

Shows:
- Impressions
- Click-through rate (CTR)
- Unique viewers

**Required screenshot 3: Engagement tab (if relevant)**

Shows:
- Average view duration
- Top-performing videos

### Screenshot requirements

YouTube Studio is desktop-only for analytics. Screenshots should be from the desktop UI at 1920×1080 or higher resolution.

| Requirement | Specification |
|------------|---------------|
| Resolution | 1920×1080 minimum |
| Format | PNG |
| Channel name | Must be visible in header |
| Date range | Must be set in screenshots |
| Custom date range | Required if claiming a specific period |

### Metrics that matter for YouTube packs

| Metric | Why buyers care |
|--------|----------------|
| Watch hours | YouTube SEO and partner program eligibility |
| CTR (click-through rate) | Thumbnail and title effectiveness |
| Average view duration | Content quality signal |
| Subscriber growth | Channel trajectory |

### Common rejection reasons

1. **Mobile app screenshots instead of Studio desktop** — Mobile app doesn't show full analytics
2. **Date range is wrong** — Studio defaults to "Last 28 days" — adjust to match your pack
3. **Revenue data visible** — Blur or crop any revenue figures before uploading

---

## LinkedIn: Screenshot Verification

### What to capture

LinkedIn Analytics are available on Creator mode accounts. Access via: Profile → Analytics → Content.

**Required screenshot 1: Creator Analytics Overview**

Shows:
- Impressions (total)
- Engagement rate
- Follower growth

**Required screenshot 2: Post Performance**

Shows specific post metrics including reach and engagement numbers.

### Screenshot requirements

| Requirement | Specification |
|------------|---------------|
| Resolution | 1920×1080 minimum (desktop) |
| Format | PNG or JPEG |
| Profile name | Must be visible |
| Date range | Must match stated period |

### Metrics that matter for LinkedIn packs

| Metric | Signal |
|--------|--------|
| Profile views | Visibility |
| Post impressions | Reach |
| Engagement rate | Content resonance |
| Follower growth | Authority building |
| Connection requests | Inbound interest |

---

## All Platforms: Self-Reported Fallback

If you cannot provide API or screenshot verification, you can still list a pack with self-reported metrics. These display with a "Self-Reported" label and grey badge, making the trust level explicit to buyers.

When to use self-reported:
- Your platform doesn't store historical analytics beyond what's available now
- You operated on a platform that has since changed its analytics UI
- Your account was deleted or suspended (include a note explaining this)

Self-reported packs can still earn "Trusted" badge through reviews. A pack with 20 five-star reviews from real mentees is credible even without API verification.

---

## Verification Review Process

1. **Submit proof** via API or web UI
2. **Automated scan** — system checks file format, resolution, and basic metadata
3. **Manual review** — reviewer compares screenshot contents against stated metrics
4. **Result** — within 48 hours:
   - **Approved**: Badge updated, trust score recalculated
   - **Rejected**: Rejection reason returned; you can resubmit
   - **Partial**: Some metrics verified, others rejected (badge shows which are verified)

---

## Appeal Process

If your proof is rejected and you believe the rejection is incorrect:

1. Reply to the rejection notification with your explanation
2. Provide additional context (e.g., "The date range shown is a sub-period of my stated 6-week period")
3. Appeals are reviewed within 5 business days

If a mentee disputes your proof:

1. You'll receive a dispute notification with the mentee's specific claim
2. You have 5 business days to respond with counter-evidence
3. A final decision is made by the review team
4. If the dispute is upheld, the proof is removed and your trust score is recalculated

---

## Verification Checklist

Before submitting proofs, confirm:

- [ ] Screenshots are full resolution (not compressed by chat apps or email)
- [ ] Date range is visible and matches your stated period
- [ ] Account name/handle is visible in at least one screenshot
- [ ] Numbers are not cropped or blurred
- [ ] No personal information (email, phone) is visible — blur if needed
- [ ] No API keys or credentials are visible in browser tabs or other windows
- [ ] File format is PNG or JPEG
- [ ] File size is under 10 MB per screenshot
