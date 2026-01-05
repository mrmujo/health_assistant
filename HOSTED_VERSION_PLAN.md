# Hosted Health Assistant - E2E Encrypted Multi-Tenant

## Requirements
- Free hosting (stay within free tiers permanently)
- End-to-end encryption (host cannot see user data)
- Magic link registration (email only)
- User provides own AI API key (client-side AI calls)

---

## Recommended Stack

| Component | Service | Free Tier Limits |
|-----------|---------|------------------|
| Hosting | Vercel | 100GB bandwidth, serverless |
| Database | Supabase | 500MB, 50k MAU, built-in auth |
| Auth | Supabase Auth | Magic links included free |
| Encryption | Web Crypto API | Browser-native |
| AI | Client-side calls | User's own API key |

**Why Supabase over MongoDB:**
- Magic link auth built-in (no email service needed)
- Row Level Security (RLS) for tenant isolation at DB level
- PostgreSQL better for structured health data
- Generous free tier (50,000 monthly active users)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         BROWSER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Encryption  │  │ IndexedDB   │  │ Direct AI Calls     │ │
│  │ (Web Crypto)│  │ (Keys+Cache)│  │ (User's API Key)    │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                    (encrypted data only)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      VERCEL (SvelteKit)                      │
│  - Auth callbacks                                            │
│  - Garmin OAuth → immediate encryption                       │
│  - Store/retrieve encrypted blobs                            │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE                                  │
│  - Auth (magic link)                                         │
│  - PostgreSQL with RLS                                       │
│  - encrypted_data table (blobs only)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (Supabase PostgreSQL)

```sql
-- User encryption public keys (for Garmin sync encryption)
CREATE TABLE user_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All health data stored as encrypted blobs
CREATE TABLE encrypted_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  data_type TEXT NOT NULL,  -- 'sleep', 'activity', 'stress', 'food', etc.
  date TEXT,                -- YYYY-MM-DD (unencrypted for querying)
  encrypted_blob TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garmin tokens (encrypted)
CREATE TABLE garmin_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  encrypted_token TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE encrypted_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own data" ON encrypted_data
  FOR ALL USING (auth.uid() = user_id);
```

---

## Key User Flows

### 1. Registration
1. User enters email → Supabase sends magic link
2. User clicks link → authenticated
3. Browser generates AES-256 key (Web Crypto)
4. Key stored in IndexedDB (never leaves device)
5. Public key sent to server for Garmin encryption

### 2. Client-Side Encryption
```typescript
const key = await crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
);
// Store in IndexedDB, encrypt all data before sending to server
```

### 3. Garmin Sync (Hybrid)
1. User initiates OAuth
2. Server receives Garmin data
3. Server encrypts immediately with user's public key
4. Client decrypts with private key
*Note: Server briefly sees Garmin data. Offer CSV import for full E2E.*

### 4. AI Chat (Client-Side)
1. User stores their API key in IndexedDB
2. Client decrypts health data locally
3. Client calls Anthropic/OpenAI directly
4. Your server never sees health data or AI conversations

---

## Implementation Phases

### Phase 1: Auth & Encryption Foundation
- Set up Supabase project
- Implement magic link auth
- Create client-side encryption utilities
- Key generation + IndexedDB storage

### Phase 2: Migrate Data Layer
- Encrypt-before-save on all writes
- Decrypt-after-fetch on all reads
- Client-side data caching

### Phase 3: Client-Side AI
- API key input (stored encrypted in IndexedDB)
- Direct browser → Anthropic calls
- Streaming responses client-side

### Phase 4: Garmin Hybrid Encryption
- Public key encryption on server
- Immediate encryption after fetch
- Optional CSV import (full E2E)

### Phase 5: Deploy
- Vercel deployment
- Supabase production setup
- Key recovery flow

---

## Trade-offs

| Issue | Mitigation |
|-------|------------|
| Key loss = data loss | Backup phrase or email recovery |
| Single device default | QR code key transfer between devices |
| Garmin not fully E2E | Offer manual CSV import option |
| No server-side search | Client decrypts and searches locally |
| 500MB DB limit | Should be fine for health data |

---

## Open Questions
1. Key recovery: backup phrase vs email-encrypted key?
2. Multi-device sync: QR transfer vs cloud backup?
3. Offline support needed?
