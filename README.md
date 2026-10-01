# @i-identity/icons

Icon library ของทีม — **ต้นฉบับอยู่ใน Figma** ส่วน repo นี้ build เป็น Iconify JSON ให้ Nuxt UI / `@nuxt/icon` ใช้ได้ทันที

```
Designer (Figma)                GitHub (repo นี้)                          Dev (Nuxt project)
──────────────────              ─────────────────────────────────         ─────────────────────
แก้ไอคอน → Plugin  ──PR──▶  Check icons: ตรวจกติกา + Preview
"Icon Push to GitHub"          │ merge
                               ▼
                         Release: PR "Release icons" (bump + CHANGELOG)
                               │ merge
                               ▼
                         publish @i-identity/icons ──────────────────▶  npm update → i-np-ชื่อไอคอน
```

## ตั้งค่าครั้งแรก (Admin, ~15 นาที)

1. สร้าง repo ใหม่ชื่อ `icons` ใน org แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
2. แก้ `package.json`
   - `name` → `@<ชื่อ owner ใน GitHub ตัวพิมพ์เล็ก>/icons` (GitHub Packages บังคับให้ scope ตรงกับ owner)
   - `repository.url` → URL ของ repo
   - `iconPrefix` → prefix ที่ Dev จะเรียก (ค่าเริ่มต้น `np` → `i-np-wallet-check`)
3. รัน `npm install` แล้ว commit `package-lock.json` (CI ใช้ `npm ci`)
4. **Settings → Actions → General → Workflow permissions** เลือก *Read and write* และติ๊ก *Allow GitHub Actions to create and approve pull requests*
5. (แนะนำ) **Settings → Branches** ตั้ง branch protection ให้ `main` ต้องผ่าน *Check icons* และมีคนรีวิวก่อน merge
6. ลบไอคอนตัวอย่างใน `svg/` เมื่อมีไอคอนจริงแล้ว

## Designer: ส่งไอคอนจาก Figma

ใช้ plugin **Icon Push to GitHub** (โฟลเดอร์ `figma-icon-push`) — ดูวิธีติดตั้งใน README ของ plugin

กติกาไอคอน (CI จะไม่ให้ผ่านถ้าผิด):

| กติกา | เหตุผล |
|---|---|
| Component เดี่ยว (ไม่ใช่ variant) ขนาด 24×24 | ได้ viewBox `0 0 24 24` ตรงกับ Lucide |
| ชื่อ kebab-case เช่น `wallet-check` (ใส่กลุ่มได้: `payment/wallet-check` — ใช้คำท้ายสุด) | ชื่อนี้คือชื่อที่ Dev เรียกใช้ |
| สีดำสีเดียว, เส้น 2px, round cap/join | build แปลงทุกสีเป็น `currentColor` ไอคอนจึงเปลี่ยนสีตาม Token ได้ |
| ห้ามมี Text / รูปภาพ / เงา | SVG ไอคอนไม่รองรับ |
| **ห้ามเปลี่ยนชื่อหรือลบไอคอนที่ปล่อยแล้วผ่าน plugin** | โค้ดที่ใช้อยู่จะพัง — ให้ Dev ทำใน PR แยก และเลือกเวอร์ชันเป็น major |

## Dev: ติดตั้งและเรียกใช้

`.npmrc` ในโปรเจกต์ (token = Personal access token *classic* ที่มีสิทธิ์ `read:packages`):

```
@i-identity:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_PACKAGES_TOKEN}
```

```bash
npm i @i-identity/icons
```

```ts
// nuxt.config.ts
import npIcons from '@i-identity/icons/icons.json'

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  icon: { customCollections: [npIcons] }
})
```

```vue
<UIcon name="i-np-wallet-check" class="size-5 text-primary" />
<UButton icon="i-np-receipt-refund" label="คืนเงิน" color="neutral" variant="outline" />
```

ต้องการรายชื่อไอคอนแบบ type-safe: `import { iconNames, type IconId } from '@i-identity/icons'`

อัปเดตไอคอน: `npm update @i-identity/icons` — ดูว่าเปลี่ยนอะไรใน `CHANGELOG.md` / GitHub Releases

## เวอร์ชัน

| เปลี่ยนแปลง | เวอร์ชัน | ใครเลือก |
|---|---|---|
| แก้รูปไอคอนเดิม | patch | plugin เลือกให้อัตโนมัติ |
| เพิ่มไอคอนใหม่ | minor | plugin เลือกให้อัตโนมัติ |
| ลบ / เปลี่ยนชื่อไอคอน | major | Dev ใส่ changeset เอง (`npx changeset`) |

## ทางสำรอง: ดึงทั้งหน้าจาก Figma

workflow **Sync icons from Figma** (กด *Run workflow* ในแท็บ Actions) ดึงทุก Component ใต้ node ที่กำหนดแล้วเปิด PR ให้ ต้องตั้งค่า:

- Secret `FIGMA_TOKEN` — Figma personal access token (scope `file_content:read`)
- Variable `FIGMA_FILE_KEY` — เช่น `bZb2X6TMQdBSaeJPUcLsga`
- Variable `FIGMA_ICONS_NODE` — node id ของหน้า/Frame ไอคอน (จาก `?node-id=123-456`)

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run build` | ตรวจกติกา + สร้าง `dist/` (icons.json, index.mjs, index.d.ts, preview.html) |
| `npm run sync:figma` | ดึง SVG จาก Figma (ต้องมี env ด้านบน) |
| `npx changeset` | บันทึกการเปลี่ยนแปลงด้วยมือ (เช่น ลบไอคอน) |
