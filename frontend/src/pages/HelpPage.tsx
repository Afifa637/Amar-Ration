import { useState } from "react";

type HelpItem = {
  title: string;
  description: string;
  steps?: string[];
};

const distributorHelpSections: HelpItem[] = [
  {
    title: "ড্যাশবোর্ড",
    description:
      "ড্যাশবোর্ডে ডিস্ট্রিবিউটর তার দৈনিক কাজের সারাংশ দেখতে পারবেন। এখানে মোট টোকেন, ব্যবহৃত টোকেন, স্টক আউট এবং গুরুত্বপূর্ণ তথ্য দেখানো হয়।",
    steps: [
      "ড্যাশবোর্ডে প্রবেশ করে সারাংশ তথ্য দেখুন",
      "সাম্প্রতিক কার্যক্রম পর্যবেক্ষণ করুন",
      "যেকোনো সেকশনে যেতে মেনু ব্যবহার করুন",
    ],
  },
  {
    title: "উপকারভোগী তালিকা",
    description:
      "এই অংশে উপকারভোগীদের নাম, কোড, ওয়ার্ড এবং প্রাসঙ্গিক তথ্য দেখা যায়। বিতরণের আগে সঠিক উপকারভোগী শনাক্ত করতে এই পেজ ব্যবহার করা হয়।",
    steps: [
      "সার্চ বক্সে নাম বা কনজিউমার কোড লিখুন",
      "তালিকা থেকে সঠিক উপকারভোগী শনাক্ত করুন",
      "পরবর্তী বিতরণ ধাপে যান",
    ],
  },
  {
    title: "কার্ড / টোকেন ব্যবস্থাপনা",
    description:
      "এই অংশ থেকে নতুন টোকেন ইস্যু করা, টোকেন স্ট্যাটাস দেখা এবং প্রয়োজনে ইস্যু করা টোকেন বাতিল করা যায়।",
    steps: [
      "‘টোকেন ইস্যু’ বাটনে ক্লিক করুন",
      "Consumer Code বা QR ডাটা দিন",
      "ইস্যু করলে টোকেন তালিকায় নতুন এন্ট্রি দেখা যাবে",
      "প্রয়োজন হলে ইস্যুড টোকেন বাতিল করা যাবে",
    ],
  },
  {
    title: "স্টক ও বিতরণ সেশন",
    description:
      "এই পেজে ইস্যুকৃত টোকেনের ভিত্তিতে রেশন বিতরণ সম্পন্ন করা হয়। প্রত্যাশিত ও বাস্তব বিতরণের পরিমাণ এখানে সংরক্ষিত হয়।",
    steps: [
      "লাইভ টোকেন তালিকা থেকে ইস্যুড টোকেন নির্বাচন করুন",
      "‘সম্পন্ন’ বাটনে ক্লিক করুন",
      "বাস্তব বিতরণকৃত পরিমাণ (কেজি) দিন",
      "সেভ করলে বিতরণ রেকর্ড তৈরি হবে",
    ],
  },
  {
    title: "বিতরণ রেকর্ড",
    description:
      "সম্পন্ন হওয়া প্রতিটি বিতরণের তথ্য রেকর্ড আকারে সংরক্ষিত থাকে। এর মাধ্যমে পূর্বের বিতরণ ইতিহাস যাচাই করা যায়।",
    steps: [
      "বিতরণ রেকর্ড সেকশনে যান",
      "সময়, টোকেন, উপকারভোগী ও পরিমাণ দেখুন",
      "মিসম্যাচ থাকলে তা চিহ্নিত করুন",
    ],
  },
  {
    title: "রিপোর্ট ও বিশ্লেষণ",
    description:
      "এই অংশ থেকে বিতরণ রিপোর্ট, স্টক রিকনসিলিয়েশন, টোকেন বিশ্লেষণ এবং অডিট রিপোর্ট দেখা যায়।",
    steps: [
      "প্রয়োজন অনুযায়ী তারিখ ও ফিল্টার নির্বাচন করুন",
      "রিপোর্ট টাইপ নির্বাচন করুন",
      "CSV ডাউনলোড বা প্রিন্ট অপশন ব্যবহার করুন",
    ],
  },
  {
    title: "মনিটরিং",
    description:
      "এই অংশে সিস্টেম স্ট্যাটাস, সতর্কতা, ব্ল্যাকলিস্ট এবং অফলাইন কিউ পর্যবেক্ষণ করা যায়।",
    steps: [
      "সিস্টেম মনিটরিং সারাংশ দেখুন",
      "ব্ল্যাকলিস্ট এন্ট্রি পর্যালোচনা করুন",
      "অফলাইন কিউ থাকলে সিঙ্ক করুন",
    ],
  },
];

const faqs: HelpItem[] = [
  {
    title: "টোকেন ইস্যু হচ্ছে না কেন?",
    description:
      "Consumer Code বা QR ডাটা সঠিকভাবে প্রদান করা হয়েছে কি না তা যাচাই করুন। ভুল ইনপুট বা অকার্যকর কোড হলে টোকেন ইস্যু ব্যর্থ হতে পারে।",
  },
  {
    title: "বিতরণ সম্পন্ন করার পরে মিসম্যাচ কেন দেখাচ্ছে?",
    description:
      "প্রত্যাশিত পরিমাণ এবং বাস্তব বিতরণকৃত পরিমাণ আলাদা হলে সিস্টেম মিসম্যাচ দেখায়। ইনপুট করা কেজি পুনরায় যাচাই করুন।",
  },
  {
    title: "অফলাইন কিউ কী?",
    description:
      "ইন্টারনেট বা সার্ভার সমস্যা হলে কিছু ডেটা অস্থায়ীভাবে অফলাইন কিউতে জমা থাকতে পারে। পরে সেগুলো সিঙ্ক করা যায়।",
  },
  {
    title: "বাতিল টোকেন কি পুনরায় ব্যবহার করা যাবে?",
    description:
      "না। বাতিল করা টোকেন পুনরায় ব্যবহারের জন্য বৈধ নয়। প্রয়োজনে নতুন টোকেন ইস্যু করতে হবে।",
  },
];

function HelpCard({
  item,
  defaultOpen = false,
}: {
  item: HelpItem;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#d7dde6] rounded bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left bg-[#f8fafc] hover:bg-[#f1f5f9]"
      >
        <span className="text-[14px] font-semibold text-[#1f2d3d]">
          {item.title}
        </span>
        <span className="text-[13px] text-[#6b7280]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          <p className="text-[13px] text-[#4b5563]">{item.description}</p>

          {item.steps && item.steps.length > 0 && (
            <div>
              <div className="text-[13px] font-medium text-[#1f2d3d] mb-2">
                করণীয় ধাপসমূহ:
              </div>
              <ol className="list-decimal ml-5 space-y-1 text-[13px] text-[#4b5563]">
                {item.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-[#d7dde6] rounded px-4 py-4">
        <h1 className="text-[16px] font-semibold text-[#1f2d3d]">
          সহায়তা ও নির্দেশনা
        </h1>
        <p className="text-[13px] text-[#6b7280] mt-2">
          ডিস্ট্রিবিউটর পোর্টালের বিভিন্ন ফিচার ব্যবহারের নির্দেশনা, সাধারণ
          সমস্যা ও সমাধান এবং সহায়তা যোগাযোগের তথ্য এখানে দেওয়া হয়েছে।
        </p>
      </div>

      {/* Quick Help */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-[#d7dde6] rounded px-4 py-3">
          <div className="text-[13px] font-semibold text-[#1f2d3d]">
            দ্রুত সহায়তা
          </div>
          <p className="text-[12px] text-[#6b7280] mt-2">
            প্রথমে ড্যাশবোর্ড দেখে কাজের সারাংশ বুঝুন, তারপর টোকেন ইস্যু ও
            বিতরণ প্রক্রিয়া অনুসরণ করুন।
          </p>
        </div>

        <div className="bg-white border border-[#d7dde6] rounded px-4 py-3">
          <div className="text-[13px] font-semibold text-[#1f2d3d]">
            গুরুত্বপূর্ণ সতর্কতা
          </div>
          <p className="text-[12px] text-[#6b7280] mt-2">
            ভুল উপকারভোগী নির্বাচন বা ভুল কেজি ইনপুট করলে মিসম্যাচ তৈরি হতে
            পারে। সংরক্ষণের আগে তথ্য যাচাই করুন।
          </p>
        </div>

        <div className="bg-white border border-[#d7dde6] rounded px-4 py-3">
          <div className="text-[13px] font-semibold text-[#1f2d3d]">
            সহায়তা যোগাযোগ
          </div>
          <p className="text-[12px] text-[#6b7280] mt-2">
            প্রযুক্তিগত সমস্যার জন্য সিস্টেম অ্যাডমিন বা সাপোর্ট টিমের সাথে
            যোগাযোগ করুন।
          </p>
        </div>
      </div>

      {/* Functional Help */}
      <div className="space-y-3">
        <div className="text-[14px] font-semibold text-[#1f2d3d]">
          ফিচারভিত্তিক নির্দেশনা
        </div>
        {distributorHelpSections.map((item, index) => (
          <HelpCard key={index} item={item} defaultOpen={index === 0} />
        ))}
      </div>

      {/* FAQ */}
      <div className="space-y-3">
        <div className="text-[14px] font-semibold text-[#1f2d3d]">
          প্রায়শই জিজ্ঞাসিত প্রশ্ন (FAQ)
        </div>
        {faqs.map((item, index) => (
          <HelpCard key={index} item={item} />
        ))}
      </div>

      {/* Footer Note */}
      <div className="bg-[#f8fafc] border border-[#d7dde6] rounded px-4 py-3">
        <p className="text-[12px] text-[#6b7280]">
          নোট: এই সহায়তা পেজটি ডিস্ট্রিবিউটরদের দৈনন্দিন কার্যক্রম সহজভাবে
          পরিচালনার জন্য তৈরি করা হয়েছে।
        </p>
      </div>
    </div>
  );
}