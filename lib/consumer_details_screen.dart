import 'package:flutter/material.dart';
import 'qr_scanner_screen.dart';
import 'services/api_service.dart';

class ConsumerDetailsScreen extends StatefulWidget {
  final String rawPayload;
  final Map<String, String>? parsedData;

  const ConsumerDetailsScreen({
    Key? key,
    required this.rawPayload,
    this.parsedData,
  }) : super(key: key);

  @override
  State<ConsumerDetailsScreen> createState() => _ConsumerDetailsScreenState();
}

class _ConsumerDetailsScreenState extends State<ConsumerDetailsScreen> {
  Map<String, dynamic>? _preview;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadPreview();
  }

  Future<void> _loadPreview() async {
    try {
      final data = await ApiService.consumerPreview(widget.rawPayload);
      if (mounted) setState(() { _preview = data; _loading = false; });
    } on ApiException catch (e) {
      if (mounted) setState(() { _error = e.message; _loading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = 'তথ্য লোড করতে ব্যর্থ হয়েছে'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        elevation: 0,
        title: const Text(
          'গ্রাহকের তথ্য',
          style: TextStyle(
            fontFamily: 'Anek Bangla',
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _loading
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: Color(0xFF1f77b4)),
                  SizedBox(height: 16),
                  Text(
                    'তথ্য লোড হচ্ছে...',
                    style: TextStyle(fontFamily: 'Anek Bangla', fontSize: 16, color: Color(0xFF555555)),
                  ),
                ],
              ),
            )
          : _error != null && _preview == null
              ? _buildErrorBody()
              : _buildSuccessBody(),
    );
  }

  Widget _buildErrorBody() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 64, color: Color(0xFFdc3545)),
            const SizedBox(height: 16),
            const Text(
              'তথ্য লোড হয়নি',
              style: TextStyle(
                fontFamily: 'Anek Bangla',
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: Color(0xFFdc3545),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'Anek Bangla',
                fontSize: 14,
                color: Color(0xFF666666),
                height: 1.6,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: () {
                setState(() { _loading = true; _error = null; });
                _loadPreview();
              },
              icon: const Icon(Icons.refresh, color: Colors.white),
              label: const Text('আবার চেষ্টা করুন',
                  style: TextStyle(fontFamily: 'Anek Bangla', fontSize: 15, color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1f77b4),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: () => Navigator.pushReplacement(
                context, MaterialPageRoute(builder: (_) => const QRScannerScreen())),
              icon: const Icon(Icons.qr_code_scanner, color: Color(0xFF1f77b4)),
              label: const Text('পুনরায় স্কেন করুন',
                  style: TextStyle(fontFamily: 'Anek Bangla', fontSize: 14, color: Color(0xFF1f77b4))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSuccessBody() {
    final p = _preview!;
    final consumer = p['consumer'] as Map<String, dynamic>? ?? {};
    final card = p['card'] as Map<String, dynamic>? ?? {};
    final qr = p['qr'] as Map<String, dynamic>? ?? {};
    final session = p['session'] as Map<String, dynamic>? ?? {};

    final String consumerStatus = (consumer['status'] as String? ?? '').toLowerCase();
    final String blacklistStatus = (consumer['blacklistStatus'] as String? ?? 'none').toLowerCase();
    final String cardStatus = (card['cardStatus'] as String? ?? '').toLowerCase();
    final String qrStatus = (qr['qrStatus'] as String? ?? '').toLowerCase();
    final bool alreadyIssued = session['alreadyIssued'] == true;
    final String sessionStatus = (session['status'] as String? ?? 'none').toLowerCase();

    // Determine eligibility
    final bool eligible = consumerStatus == 'active' &&
        blacklistStatus == 'none' &&
        cardStatus == 'active' &&
        qrStatus == 'active' &&
        !alreadyIssued;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          // ── Eligibility banner ──────────────────────────────────────────
          _buildEligibilityBanner(eligible, alreadyIssued, consumerStatus, blacklistStatus, cardStatus, qrStatus),

          const SizedBox(height: 16),

          // ── Consumer info card ──────────────────────────────────────────
          _buildInfoCard(consumer, card, qr),

          const SizedBox(height: 16),

          // ── Session status ──────────────────────────────────────────────
          if (sessionStatus != 'none') _buildSessionCard(sessionStatus, alreadyIssued),
          if (sessionStatus != 'none') const SizedBox(height: 16),

          // ── Scan again button ───────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () => Navigator.pushReplacement(
                context, MaterialPageRoute(builder: (_) => const QRScannerScreen())),
              icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
              label: const Text('পুনরায় স্কেন করুন',
                  style: TextStyle(fontFamily: 'Anek Bangla', fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1f77b4),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildEligibilityBanner(bool eligible, bool alreadyIssued,
      String consumerStatus, String blacklistStatus, String cardStatus, String qrStatus) {
    Color bgColor;
    Color borderColor;
    IconData icon;
    String title;
    String reason;

    if (alreadyIssued) {
      bgColor = const Color(0xFFFFF8E1);
      borderColor = const Color(0xFFFFA000);
      icon = Icons.check_circle_outline;
      title = 'ইতিমধ্যে রেশন নেওয়া হয়েছে';
      reason = 'এই মাসে এই গ্রাহক ইতিমধ্যে রেশন সংগ্রহ করেছেন।';
    } else if (blacklistStatus != 'none') {
      bgColor = const Color(0xFFFCE4EC);
      borderColor = const Color(0xFFc62828);
      icon = Icons.block;
      title = 'কালো তালিকাভুক্ত';
      reason = 'এই গ্রাহক কালো তালিকায় রয়েছেন — রেশন প্রদান করবেন না।';
    } else if (!eligible) {
      bgColor = const Color(0xFFFFF0F0);
      borderColor = const Color(0xFFdc3545);
      icon = Icons.cancel;
      title = 'রেশন পাওয়ার যোগ্য নয়';
      reason = _ineligibilityReason(consumerStatus, cardStatus, qrStatus);
    } else {
      bgColor = const Color(0xFFE8F5E9);
      borderColor = const Color(0xFF2E7D32);
      icon = Icons.verified;
      title = 'রেশন পাওয়ার যোগ্য ✓';
      reason = 'এই গ্রাহক রেশন পাওয়ার যোগ্য। বিতরণ করুন।';
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: bgColor,
        border: Border.all(color: borderColor, width: 2.5),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Icon(icon, size: 60, color: borderColor),
          const SizedBox(height: 12),
          Text(title,
            textAlign: TextAlign.center,
            style: TextStyle(fontFamily: 'Anek Bangla', fontSize: 24, fontWeight: FontWeight.bold, color: borderColor)),
          const SizedBox(height: 8),
          Text(reason,
            textAlign: TextAlign.center,
            style: const TextStyle(fontFamily: 'Anek Bangla', fontSize: 14, color: Color(0xFF444444), height: 1.5)),
        ],
      ),
    );
  }

  String _ineligibilityReason(String consumerStatus, String cardStatus, String qrStatus) {
    if (consumerStatus != 'active') return 'গ্রাহকের অ্যাকাউন্ট সক্রিয় নেই (স্ট্যাটাস: $consumerStatus)।';
    if (cardStatus != 'active') return 'রেশন কার্ড সক্রিয় নেই (কার্ড স্ট্যাটাস: $cardStatus)।';
    if (qrStatus != 'active') return 'QR কোড সক্রিয় নেই (QR স্ট্যাটাস: $qrStatus)।';
    return 'এই গ্রাহক বর্তমানে রেশন পাওয়ার যোগ্য নয়।';
  }

  Widget _buildInfoCard(Map<String, dynamic> consumer, Map<String, dynamic> card, Map<String, dynamic> qr) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE0E0E0)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.person, color: Color(0xFF1f77b4), size: 20),
            SizedBox(width: 8),
            Text('গ্রাহকের তথ্য',
                style: TextStyle(fontFamily: 'Anek Bangla', fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFF333333))),
          ]),
          const SizedBox(height: 12),
          _infoRow(Icons.badge, 'নাম', consumer['name'] as String? ?? '—'),
          _divider(),
          _infoRow(Icons.numbers, 'গ্রাহক কোড', consumer['consumerCode'] as String? ?? '—'),
          _divider(),
          _infoRow(Icons.category, 'ক্যাটাগরি', _categoryLabel(consumer['category'] as String? ?? '')),
          _divider(),
          _infoRow(Icons.location_on, 'বিভাগ', consumer['division'] as String? ?? '—'),
          _divider(),
          _infoRow(Icons.map, 'উপজেলা', consumer['upazila'] as String? ?? '—'),
          _divider(),
          _infoRow(Icons.apartment, 'ইউনিয়ন', consumer['unionName'] as String? ?? '—'),
          _divider(),
          _infoRow(Icons.tag, 'ওয়ার্ড', (consumer['ward'] ?? '—').toString()),
          _divider(),
          _infoRow(Icons.credit_card, 'কার্ড স্ট্যাটাস', _statusLabel(card['cardStatus'] as String? ?? '')),
          _divider(),
          _infoRow(Icons.qr_code, 'QR স্ট্যাটাস', _statusLabel(qr['qrStatus'] as String? ?? '')),
          if (qr['validTo'] != null) ...[
            _divider(),
            _infoRow(Icons.calendar_today, 'QR মেয়াদ', _formatDate(qr['validTo'] as String)),
          ],
        ],
      ),
    );
  }

  Widget _buildSessionCard(String sessionStatus, bool alreadyIssued) {
    final color = alreadyIssued ? const Color(0xFFFFA000) : const Color(0xFF1f77b4);
    final label = sessionStatus == 'open' ? 'বিতরণ সেশন চলছে' : 'বিতরণ সেশন পরিকল্পিত';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        border: Border.all(color: color.withOpacity(0.4)),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(children: [
        Icon(Icons.event_available, color: color, size: 22),
        const SizedBox(width: 10),
        Expanded(child: Text(label,
            style: TextStyle(fontFamily: 'Anek Bangla', fontSize: 14, color: color, fontWeight: FontWeight.w600))),
      ]),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(children: [
        Icon(icon, size: 17, color: const Color(0xFF888888)),
        const SizedBox(width: 10),
        Expanded(flex: 2,
            child: Text(label,
                style: const TextStyle(fontFamily: 'Anek Bangla', fontSize: 13, color: Color(0xFF888888)))),
        Expanded(flex: 3,
            child: Text(value,
                textAlign: TextAlign.right,
                style: const TextStyle(fontFamily: 'Anek Bangla', fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF222222)))),
      ]),
    );
  }

  Widget _divider() => const Divider(height: 1, color: Color(0xFFF0F0F0));

  String _statusLabel(String s) {
    switch (s.toLowerCase()) {
      case 'active': return 'সক্রিয়';
      case 'inactive': return 'নিষ্ক্রিয়';
      case 'expired': return 'মেয়াদোত্তীর্ণ';
      case 'suspended': return 'স্থগিত';
      case 'revoked': return 'বাতিল';
      default: return s.isEmpty ? '—' : s;
    }
  }

  String _categoryLabel(String s) {
    switch (s.toLowerCase()) {
      case 'general': return 'সাধারণ';
      case 'freedom_fighter': return 'মুক্তিযোদ্ধা';
      case 'priority': return 'অগ্রাধিকার';
      default: return s.isEmpty ? '—' : s;
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
    } catch (_) { return iso; }
  }
}
