# nirmata/kyverno-aibom-reference

Reference architecture for AI agent governance using Nirmata's AIBOM scanner
(via `nctl agent aibom`), cosign, and Kyverno `ImageValidatingPolicy`.

Companion to the Nirmata engineering blog post:
**"Agent Discovery Before the First Request: AIBOM Attestation and Kyverno at Admission Control"**

---

## What this repo contains

```
.
├── src/
│   └── research-agent.ts       # Example TypeScript agent (@anthropic-ai/sdk)
├── policies/
│   ├── require-aibom-attestation.yaml   # Policy 1: verify attestation signature
│   └── enforce-aibom-constraints.yaml   # Policy 2: enforce framework/tool/model list
├── .github/
│   └── workflows/
│       └── build-attest.yml    # CI: generate → gate → publish → attest
├── aibom-baseline.json         # Approved AIBOM baseline (commit to repo)
├── .aibom.yaml                 # aibom scanner configuration
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- [nctl](https://nirmata.com/contact) — Nirmata CLI (includes `nctl agent aibom`)
- [cosign](https://github.com/sigstore/cosign) — OCI attestation signing
- [Kyverno](https://kyverno.io) 1.14+ — installed in your cluster

---

## Quickstart

### 1. Scan your source

```bash
# Table output (human-readable)
nctl agent aibom generate .

# JSON output — save as baseline
nctl agent aibom generate . --output json --file aibom-baseline.json

# SARIF — upload to GitHub Security tab
nctl agent aibom generate . --output sarif --file results.sarif
```

### 2. Gate on baseline diff

```bash
# After making changes, generate a current scan
nctl agent aibom generate . --output json --file aibom-current.json

# Fail if any new agents/tools/models were added vs the baseline
nctl agent aibom diff aibom-baseline.json aibom-current.json --fail-on added

# Fail on any change at all
nctl agent aibom diff aibom-baseline.json aibom-current.json --fail-on any-change

# --fail-on options for generate: agents, tools, models, any, risk-score=N
# --fail-on options for diff:     added, removed, changed, any-change
```

### 3. Apply Kyverno policies

```bash
# Update the registry glob and GitHub subject in both policy files first
kubectl apply -f policies/require-aibom-attestation.yaml
kubectl apply -f policies/enforce-aibom-constraints.yaml
```

### 4. Attest AIBOM to your image (manual)

```bash
# Build and push your image first, capture the digest
IMAGE="registry.example.com/agents/research-agent:latest"
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' "$IMAGE" | cut -d@ -f2)

# Generate AIBOM
nctl agent aibom generate . --output json --file aibom.json

# Attest (requires COSIGN_EXPERIMENTAL=1 for keyless)
COSIGN_EXPERIMENTAL=1 cosign attest \
  --predicate aibom.json \
  --type https://nirmata.com/aibom/v1 \
  "$IMAGE@$DIGEST"
```

---

## CI pipeline

The GitHub Actions workflow (`.github/workflows/build-attest.yml`) runs on every
push to `main` and every PR:

| Step | On PR | On main |
|------|-------|---------|
| Generate AIBOM JSON | ✅ | ✅ |
| Generate SARIF + upload to GitHub Security | ✅ | ✅ |
| Gate against baseline (`--fail-on added`) | ✅ | ✅ |
| Publish to Nirmata Control Hub | ❌ | ✅ |
| Attest AIBOM to image digest | ❌ | ✅ |

PRs generate and gate but don't attest — attestation only happens on
commits that land on `main`.

---

## Kyverno policy notes

### c.category vs c.type

The AIBOM JSON uses two separate fields:

- `type` — CycloneDX type (`"ml-model"`, `"library"`)
- `category` — AIBOM discriminator (`"agent"`, `"tool"`, `"model"`)

**All CEL filter expressions must use `c.category`**, not `c.type`. Using
`c.type == "agent"` will silently pass all Pods because no component has
`type == "agent"`.

### Updating the approved lists

Edit `policies/enforce-aibom-constraints.yaml` to add frameworks, tools,
or models to the approved lists. Apply the updated policy with `kubectl apply`.

### Air-gapped environments

Replace the `keyless:` attestor block with a `keys:` block referencing your
public key or KMS URI. See the
[cosign docs](https://github.com/sigstore/cosign) for key-based signing.

---

## AIBOM scanner

`nctl agent aibom` is part of the Nirmata CLI.


Supports: Python · TypeScript · Go · Java · Rust · C#

---

## License

Apache 2.0
