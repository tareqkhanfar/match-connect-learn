# EduMatch Hub

# مشروع: Match Education — نظام إدارة المدارس (School Management System)

## الهدف

ابنِ لي واجهة أمامية (Frontend) احترافية متكاملة لنظام إدارة مدارس (K-12) باسم "Match Education". النظام باللغة العربية بالكامل مع دعم RTL (من اليمين لليسار). التصميم لازم يكون عصري واحترافي ونظيف بمستوى أنظمة SaaS التعليمية العالمية.

## المتطلبات التقنية

- React + TypeScript

- Tailwind CSS

- دعم RTL كامل (dir="rtl")

- خط عربي احترافي (Cairo أو Tajawal أو IBM Plex Sans Arabic)

- Recharts للرسوم البيانية

- Responsive (موبايل + تابلت + ديسكتوب)

- Dark mode + Light mode

- أيقونات Lucide React

- بيانات وهمية (mock data) واقعية بالعربي

## هوية التصميم

- ألوان أساسية احترافية (أزرق/أخضر تعليمي هادئ مع لمسات دافئة)

- بطاقات بظلال ناعمة وحواف دائرية معتدلة

- مساحات بيضاء مريحة، Typography بتسلسل هرمي واضح

- Animations ناعمة، loading skeletons، وempty states أنيقة

## الأدوار (Roles) — النظام متعدد المستخدمين

مدير المدرسة (Admin) / المعلم (Teacher) / الطالب (Student) / ولي الأمر (Parent). كل دور يشوف لوحة تحكم ومحتوى مختلف.

## الوحدات والصفحات المطلوبة

### 1. تسجيل الدخول

شاشة أنيقة مع شعار واختيار الدور، خلفية تعليمية جذابة.

### 2. الشريط الجانبي

قابل للطي، يتغيّر حسب دور المستخدم.

### 3. لوحة التحكم الرئيسية (Dashboard)

بطاقات KPI: عدد الطلاب، عدد المعلمين، عدد الصفوف، نسبة الحضور اليوم. رسوم بيانية: الحضور عبر الزمن، توزيع الطلاب حسب الصف، الأداء الأكاديمي العام. جدول: الأحداث/الإعلانات القادمة.

### 4. إدارة الطلاب (Students)

قائمة الطلاب مع بحث وفلترة، ملف الطالب (بيانات شخصية، ولي الأمر، الصف، السجل الأكاديمي، الحضور، الرسوم). إضافة/تعديل طالب.

### 5. إدارة المعلمين (Teachers)

قائمة المعلمين، الملف الشخصي، المواد والصفوف المسندة، الجدول.

### 6. الصفوف والشُعب (Classes & Sections)

إدارة الصفوف الدراسية، الشُعب، إسناد المعلمين والمواد لكل صف.

### 7. المواد الدراسية (Subjects / Courses)

قائمة المواد، ربطها بالصفوف والمعلمين.

### 8. الحضور والغياب (Attendance)

تسجيل الحضور اليومي لكل شعبة (شبكة تفاعلية)، تقارير الحضور، نسب الغياب، تنبيهات للطلاب كثيري الغياب.

### 9. الجدول الدراسي (Timetable)

جدول أسبوعي مرئي (شبكة أيام × حصص) لكل صف ومعلم، ألوان لكل مادة.

### 10. الامتحانات والدرجات (Exams & Grades)

جدول الامتحانات، إدخال الدرجات، حساب المعدلات، بطاقة الدرجات (Report Card) قابلة للطباعة PDF بالعربي.

### 11. الواجبات (Assignments / Homework)

إنشاء واجبات، تسليم الطلاب، تصحيح المعلم.

### 12. الرسوم المالية (Fees)

هيكل الرسوم، فواتير الطلاب، حالة الدفع (مدفوع/متأخر/جزئي)، تقارير التحصيل. ملوّن حسب الحالة.

### 13. التواصل والإعلانات (Communication)

لوحة إعلانات، رسائل بين المعلم وولي الأمر، إشعارات.

### 14. التقارير (Reports)

تقارير أكاديمية، حضور، مالية — قابلة للتصدير PDF/Excel.

### 15. الإعدادات (Settings)

السنة الدراسية، الفصول، بيانات المدرسة، الأدوار والصلاحيات.

## لوحات مخصصة حسب الدور

- الطالب: جدوله، درجاته، واجباته، حضوره، رسومه.

- ولي الأمر: متابعة أبنائه (درجات، حضور، رسوم، إعلانات).

- المعلم: صفوفه، تسجيل الحضور، إدخال الدرجات، الواجبات.

## ملاحظات مهمة

- أسماء عربية واقعية (طلاب، معلمين، مواد)، عملة بالشيكل ₪ والدينار، تواريخ عربية.

- مكونات قابلة لإعادة الاستخدام، تجربة مستخدم سلسة.

- ابدأ بالشريط الجانبي + لوحة التحكم (دور المدير) أولاً، ثم إدارة الطلاب، ثم باقي الوحدات.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://match-connect-learn.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/203dda11-3a8b-48b3-b6b3-1ed63c0c7662).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
