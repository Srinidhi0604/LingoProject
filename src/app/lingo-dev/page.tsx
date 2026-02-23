"use client";

import { useRouter } from "next/navigation";

export default function LingoDevPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push("/")}
          className="mb-8 px-4 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
        >
          ← वापस जाएं
        </button>

        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          लिंगो देव डॉक्यूमेंटेशन
        </h1>
        <p className="text-zinc-400 mb-12">
          Lingo.dev एकीकरण के लिए संपूर्ण गाइड
        </p>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-violet-300">
            रनटाइम SDK उपयोग
          </h2>
          <div className="bg-[#111] rounded-xl p-6 border border-white/10">
            <p className="text-zinc-300 mb-4">
              Lingo SDK रनटाइम भाषा उपयोगिताएं प्रदान करता है।
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2">
              <li>recognizeLocale(text) - भाषा पहचान</li>
              <li>batchLocalizeText(text, options) - बैच स्थानीयकरण</li>
            </ul>
            <p className="text-yellow-400/80 mt-4 text-sm">
              नोट: SDK UI स्थानीयकरण के लिए नहीं है। कंपाइलर UI को संभालता है।
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-violet-300">
            CLI निष्कर्षण और सिंक
          </h2>
          <div className="bg-[#111] rounded-xl p-6 border border-white/10">
            <p className="text-zinc-300 mb-4">
              CLI स्थैतिक फ़ाइलों को स्थानीयकृत करता है।
            </p>
            <div className="bg-black/50 rounded-lg p-4 font-mono text-sm text-green-400 mb-4">
              npx lingo.dev@latest run
            </div>
            <p className="text-zinc-400 mb-2">डिप्लॉयमेंट सुरक्षा:</p>
            <div className="bg-black/50 rounded-lg p-4 font-mono text-sm text-green-400">
              npx lingo.dev@latest run --frozen
            </div>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-violet-300">
            CI/CD वैलिडेशन
          </h2>
          <div className="bg-[#111] rounded-xl p-6 border border-white/10">
            <p className="text-zinc-300 mb-4">
              आधिकारिक GitHub Action का उपयोग करें।
            </p>
            <div className="bg-black/50 rounded-lg p-4 font-mono text-sm text-blue-400">
              lingodotdev/lingo.dev@main
            </div>
            <ul className="list-disc list-inside text-zinc-400 mt-4 space-y-2">
              <li>अनुवाद उत्पन्न करें</li>
              <li>मेटाडेटा कैश अपडेट करें</li>
              <li>अनुवाद आर्टिफैक्ट्स कमिट करें</li>
            </ul>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-violet-300">
            MCP व्याख्या
          </h2>
          <div className="bg-[#111] rounded-xl p-6 border border-white/10">
            <p className="text-zinc-300 mb-4">
              Model Context Protocol (MCP) AI मॉडल्स को बाहरी संदर्भ प्रदान करता है।
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2">
              <li>स्ट्रक्चर्ड प्रॉम्प्ट्स प्रदान करें</li>
              <li>कोडबेस संदर्भ इंजेक्ट करें</li>
              <li>डायनामिक रिसोर्स एक्सेस</li>
            </ul>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-violet-300">
            कंपाइलर ऑप्टिमाइज़ेशन
          </h2>
          <div className="bg-[#111] rounded-xl p-6 border border-white/10">
            <p className="text-zinc-300 mb-4">
              कंपाइलर बिल्ड टाइम पर JSX से टेक्स्ट निकालता है।
            </p>
            <ul className="list-disc list-inside text-zinc-400 space-y-2">
              <li>प्रति-लोकेल एप्लिकेशन बंडल बनाएं</li>
              <li>मेटाडेटा .lingo/ में संग्रहीत करें</li>
              <li>डेटरमिनिस्टिक बिल्ड सुनिश्चित करें</li>
              <li>रनटाइम अनुवाद नहीं</li>
            </ul>
            <p className="text-zinc-400 mt-4">
              उत्पादन बिल्ड कैश-ओनली मोड का उपयोग करते हैं।
            </p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-violet-300">
            पर्यावरण चर
          </h2>
          <div className="bg-[#111] rounded-xl p-6 border border-white/10">
            <div className="space-y-4">
              <div>
                <code className="text-green-400">LINGODOTDEV_API_KEY</code>
                <p className="text-zinc-400 text-sm mt-1">
                  केवल अनुवाद जनरेशन के लिए। कैश-ओनली बिल्ड के लिए आवश्यक नहीं।
                </p>
              </div>
              <div>
                <code className="text-green-400">LINGO_BUILD_MODE</code>
                <p className="text-zinc-400 text-sm mt-1">
                  मान्य मान: translate, cache-only
                </p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4 text-violet-300">
            लोकेल स्विचिंग
          </h2>
          <div className="bg-[#111] rounded-xl p-6 border border-white/10">
            <p className="text-zinc-300 mb-4">
              कंपाइलर कॉन्टेक्स्ट का उपयोग करें:
            </p>
            <div className="bg-black/50 rounded-lg p-4 font-mono text-sm text-blue-400">
              const &#123; setLocale &#125; = useLingoContext();<br/>
              setLocale(&quot;kn&quot;);
            </div>
            <p className="text-zinc-400 mt-4 text-sm">
              यह स्थानीयकृत बिल्ड का उपयोग करके एप्लिकेशन को रीलोड करता है।
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
