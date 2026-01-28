import PortalSection from "../components/PortalSection";

export default function HelpPage() {
  return (
    <div className="space-y-3">
      <PortalSection title="সহায়তা (FAQ / নির্দেশিকা)">
        <div className="text-[12px] text-[#374151] space-y-2">
          <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">❓ QR স্ক্যান করলে “Invalid” দেখায় কেন?</div>
            <div>কার্ড Revoked/Inactive হলে স্ক্যান রিজেক্ট হবে।</div>
          </div>

          <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">❓ ডুপ্লিকেট পরিবার ফ্ল্যাগ মানে কী?</div>
            <div>একই পরিবারের একাধিক সক্রিয় উপকারভোগী থাকলে ফিল্ড ভেরিফিকেশন লাগবে।</div>
          </div>

          <div className="border border-[#d7dde6] rounded p-3 bg-[#fbfdff]">
            <div className="font-semibold">❓ ওজন মিসম্যাচ হলে কী হবে?</div>
            <div>তাৎক্ষণিক অ্যালার্ট, বিতরণ থামানো, অডিট লগ এবং এডমিন নোটিফিকেশন হবে।</div>
          </div>
        </div>
      </PortalSection>
    </div>
  );
}
