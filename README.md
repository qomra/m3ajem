<div dir="rtl">

# مَعاجِم

تطبيق شامل للمعاجم العربية مبني بـ React Native و Expo.

## نظرة عامة

مَعاجِم هو تطبيق موبايل يجمع بين المعاجم العربية التقليدية والمعاجم المتخصصة المرقمنة بالذكاء الاصطناعي، مع إمكانية البحث المتقدم والاستماع الصوتي والمساعد الذكي.

## المميزات

- **المعاجم**: تصفح والبحث في 40 معجماً عربياً
- **المفهرس**: البحث في الكلمات المفهرسة مع التجميع حسب الجذر
- **صوتي**: الاستماع لتسجيلات صوتية لمداخل المعاجم
- **ذكي**: مساعد ذكي مدعوم بالذكاء الاصطناعي
- **الإعدادات**: تخصيص المظهر وحجم الخط وإعدادات التطبيق

## الإحصائيات

| النوع | عدد المعاجم | عدد المدخلات |
|-------|-------------|--------------|
| مطبوع | 14 | 111,428 |
| مرقمنة | 26 | 95,582 |
| **المجموع** | **40** | **207,010** |

بالإضافة إلى **281,134** كلمة مفهرسة في لسان العرب.

## المعاجم المتوفرة

### المعاجم المطبوعة
- لسان العرب (مفهرس)
- الصحاح في اللغة
- مختار الصحاح
- المعجم الوسيط
- القاموس المحيط
- الغريب المصنف
- أساس البلاغة
- مجمل اللغة لابن فارس
- العين للفراهيدي
- النهاية في غريب الحديث
- معجم ديوان الأدب
- شرح المعلقات السبع
- وغيرها...

### المعاجم المرقمنة (بالذكاء الاصطناعي)
- معجم مصطلحات الحاسوب
- معجم مصطلحات الطب
- معجم مصطلحات الفيزياء
- معجم مصطلحات الكيمياء
- معجم مصطلحات الرياضيات
- معجم مصطلحات القانون
- معجم مصطلحات الاقتصاد
- معجم مصطلحات علم النفس
- معجم مصطلحات الفلسفة
- معجم مصطلحات الموسيقى
- وغيرها...

## البيانات

بيانات المعاجم متوفرة على Hugging Face:

**[mysamai/m3ajim](https://huggingface.co/datasets/mysamai/m3ajim)**

```
├── dictionaries.parquet  (0.01 MB)
├── roots.parquet         (67.87 MB)
└── words.parquet         (6.22 MB)
```

### تحويل البيانات

```bash
# تحميل من Hugging Face وإنشاء قاعدة البيانات
cd assets/data
python hf_to_db.py

# أو من ملفات محلية
python hf_to_db.py --local ./hf_dataset

# تصدير قاعدة البيانات إلى Hugging Face
python export_huggingface.py
```

## هيكل المشروع

```
m3ajem/
├── app/                  # صفحات Expo Router
│   ├── (tabs)/          # شاشات التنقل
│   └── _layout.tsx      # التخطيط الرئيسي
├── src/
│   ├── components/      # مكونات واجهة المستخدم
│   ├── screens/         # شاشات التطبيق
│   ├── hooks/           # React Hooks مخصصة
│   ├── store/           # إدارة الحالة (Zustand)
│   ├── locales/         # الترجمات (ar.json)
│   ├── theme/           # نظام المظهر
│   ├── types/           # أنواع TypeScript
│   ├── services/        # منطق الأعمال
│   └── utils/           # دوال مساعدة
├── assets/              # الملفات الثابتة
│   └── data/            # بيانات المعاجم
└── docs/                # التوثيق
```

## التقنيات المستخدمة

- **React Native** - إطار تطوير الموبايل
- **Expo** - منصة التطوير
- **TypeScript** - أمان الأنواع
- **Zustand** - إدارة الحالة
- **Expo Router** - التوجيه المبني على الملفات
- **FlashList** - قوائم عالية الأداء
- **SQLite** - قاعدة بيانات محلية

</div>

---

## iOS Build Instructions

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### iOS Build Process

For iOS development, use the automated build script:

```bash
# Debug build (for development)
npm run build:ios

# Release build (for production testing)
npm run build:ios-release
```

This script automatically:
1. Cleans and rebuilds iOS project (`expo prebuild --clean`)
2. Patches AppDelegate.swift with RTL support
3. Configures Info.plist (CFBundleDevelopmentRegion: ar)
4. Sets Arabic as primary localization
5. Installs CocoaPods dependencies
6. Configures automatic code signing
7. Sets up Xcode schemes
8. Opens Xcode workspace

### In Xcode

1. **Set your Development Team** (Signing & Capabilities tab)
2. Select your device/simulator
3. For Release builds: Edit Scheme → Run → Build Configuration → Release
4. Click Run (⌘R)
5. Test on device

**Note:** The first time you build, you'll need to set your Apple Developer Team in Xcode under the "Signing & Capabilities" tab.

### Available Scripts

```bash
npm start                   # Start Expo dev server
npm run android             # Run on Android
npm run ios                 # Run on iOS
npm run build:ios           # Build iOS (Debug)
npm run build:ios-release   # Build iOS (Release)
npm run lint                # Lint code
npm run type-check          # TypeScript type checking
```

### TestFlight / App Store

1. In Xcode: Product → Archive
2. Window → Organizer
3. Distribute App → App Store Connect
4. Upload to App Store Connect
5. In App Store Connect: TestFlight → Manage Compliance → Start Internal Testing
