const notes = [
  "ফিল্টার পরিবর্তন করলে নির্বাচিত লোকেশন অনুযায়ী সারাংশ আপডেট হবে।",
  "বাতিল/ত্রুটি বেশি হলে সংশ্লিষ্ট কেন্দ্র/ডিলারের তথ্য যাচাই করুন।",
  "আজকের টোকেন ও সফল বিতরণ মিলছে কিনা পর্যবেক্ষণ করুন।",
  "রিপোর্ট টেবিলের ডেটা পরে API থেকে আসবে (ডেমো হিসেবে দেখানো)।",
];

export default function NotesPanel() {
  return (
    <div className="bg-white border border-[#d7dde6] rounded p-3">
      <div className="text-[13px] font-semibold text-[#b91c1c] mb-2">নোট/পয়েন্টস:</div>
      <ul className="list-disc pl-5 space-y-1 text-[12px] text-[#111827]">
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
