import 'package:flutter/material.dart';
import 'qr_scanner_screen.dart';
import 'services/api_service.dart';
import 'services/scan_history_service.dart';

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
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _preview;

  @override
  void initState() {
    super.initState();
    _saveScanRecord();
    _loadPreview();
  }

  Future<void> _saveScanRecord() async {
    final record = ScanHistoryService.buildRecord(
      rawPayload: widget.rawPayload,
      parsedData: widget.parsedData,
    );
    await ScanHistoryService.addRecord(record);
  }

  Future<void> _loadPreview() async {
    if (widget.parsedData == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final data = await ApiService.consumerPreview(widget.rawPayload);
      setState(() {
        _preview = data;
        _loading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _loading = false;
      });
    } catch (_) {
      setState(() {
        _error = 'তথ্য লোড ব্যর্থ হয়েছে';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0d2b3a),
        elevation: 0,
        title: const Text(
          'স্কেন ফলাফল',
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
              child: CircularProgressIndicator(color: Color(0xFF1f77b4)),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _buildStatusBanner(),
                  const SizedBox(height: 16),
                  if (widget.parsedData != null || _preview != null)
                    _buildInfoCard(),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () => Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const QRScannerScreen()),
                      ),
                      icon: const Icon(Icons.qr_code_scanner,
                          color: Colors.white),
                      label: const Text(
                        'পুনরায় স্কেন করুন',
                        style: TextStyle(
                          fontFamily: 'Anek Bangla',
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0d2b3a),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  // ── Status banner ──────────────────────────────────────────────────────────

  Widget _buildStatusBanner() {
    if (widget.parsedData == null) {
      return _banner(
        icon: Icons.cancel,
        color: const Color(0xFFdc3545),
        bg: const Color(0xFFF8F0F0),
        title: 'অচেনা QR কোড',
        message: 'এই QR কোডটি আমার রেশন সিস্টেমের নয়',
      );
    }

    if (_error != null && _preview == null) {
      return _banner(
        icon: Icons.wifi_off_rounded,
        color: const Color(0xFF888888),
        bg: const Color(0xFFF5F5F5),
        title: 'তথ্য লোড হয়নি',
        message: _error!,
      );
    }

    if (_preview != null) {
      final consumer = _preview!['consumer'] as Map<String, dynamic>? ?? {};
      final card = _preview!['card'] as Map<String, dynamic>? ?? {};
      final qr = _preview!['qr'] as Map<String, dynamic>? ?? {};
      final session = _preview!['session'] as Map<String, dynamic>? ?? {};

      final consumerStatus = consumer['status'] as String? ?? 'Inactive';
      final cardStatus = card['cardStatus'] as String? ?? 'Inactive';
      final qrStatus = qr['qrStatus'] as String? ?? 'Invalid';
      final sessionStatus = session['status'] as String? ?? 'none';
      final alreadyIssued = session['alreadyIssued'] as bool? ?? false;
      final blacklist = consumer['blacklistStatus'] as String? ?? 'None';

      if (blacklist != 'None') {
        return _banner(
          icon: Icons.block,
          color: const Color(0xFFdc3545),
          bg: const Color(0xFFF8F0F0),
          title: 'কালো তালিকাভুক্ত',
          message: 'এই গ্রাহক কালো তালিকায় আছেন। রেশন প্রদান করা যাবে না।',
        );
      }
      if (cardStatus != 'Active' || consumerStatus != 'Active') {
        return _banner(
          icon: Icons.credit_card_off,
          color: const Color(0xFFdc3545),
          bg: const Color(0xFFF8F0F0),
          title: 'কার্ড নিষ্ক্রিয়',
          message: 'এই গ্রাহকের রেশন কার্ড সক্রিয় নেই।',
        );
      }
      if (qrStatus != 'Valid') {
        return _banner(
          icon: Icons.qr_code_2,
          color: const Color(0xFFFF6B35),
          bg: const Color(0xFFFFF3EE),
          title: 'QR অবৈধ',
          message: 'QR কোডটি বৈধ নয় (স্ট্যাটাস: ${_banglaQrStatus(qrStatus)})।',
        );
      }
      if (alreadyIssued) {
        return _banner(
          icon: Icons.check_circle,
          color: const Color(0xFF1f77b4),
          bg: const Color(0xFFEBF3FC),
          title: 'টোকেন ইতিমধ্যে ইস্যু হয়েছে',
          message: 'এই গ্রাহককে আজকে ইতিমধ্যে রেশন টোকেন দেওয়া হয়েছে।',
        );
      }
      if (sessionStatus == 'none') {
        return _banner(
          icon: Icons.event_busy,
          color: const Color(0xFFFFC107),
          bg: const Color(0xFFFFFBE6),
          title: 'কোনো বিতরণ সেশন নেই',
          message: 'এখন কোনো সক্রিয় বিতরণ সেশন নেই।',
        );
      }
      if (sessionStatus == 'planned') {
        return _banner(
          icon: Icons.schedule,
          color: const Color(0xFFFFC107),
          bg: const Color(0xFFFFFBE6),
          title: 'সেশন পরিকল্পিত',
          message: 'বিতরণ সেশন পরিকল্পিত কিন্তু এখনো শুরু হয়নি।',
        );
      }
      return _banner(
        icon: Icons.verified,
        color: const Color(0xFF28a745),
        bg: const Color(0xFFEDF7EE),
        title: 'রেশন প্রদান করা যাবে',
        message: 'কার্ড সক্রিয়, QR বৈধ এবং বিতরণ সেশন চলছে।',
      );
    }

    // Fallback: local parse only (API not called / not logged in)
    final isExpired = widget.parsedData!['expired'] == 'true';
    if (isExpired) {
      return _banner(
        icon: Icons.warning_amber_rounded,
        color: const Color(0xFFFFC107),
        bg: const Color(0xFFFFFBE6),
        title: 'QR মেয়াদোত্তীর্ণ',
        message: 'এই রেশন কার্ডের QR কোডের মেয়াদ শেষ হয়ে গেছে।',
      );
    }
    return _banner(
      icon: Icons.verified,
      color: const Color(0xFF28a745),
      bg: const Color(0xFFEDF7EE),
      title: 'বৈধ QR কোড',
      message: 'QR সফলভাবে পার্স হয়েছে।',
    );
  }

  Widget _banner({
    required IconData icon,
    required Color color,
    required Color bg,
    required String title,
    required String message,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: color, width: 2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 52, color: color),
          const SizedBox(height: 10),
          Text(
            title,
            style: TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: color,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 6),
          Text(
            message,
            style: const TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 13,
              color: Color(0xFF555555),
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  // ── Info card ──────────────────────────────────────────────────────────────

  Widget _buildInfoCard() {
    final p = widget.parsedData;
    final c = _preview?['consumer'] as Map<String, dynamic>?;
    final card = _preview?['card'] as Map<String, dynamic>?;
    final qr = _preview?['qr'] as Map<String, dynamic>?;

    final name = c?['name'] as String? ?? '—';
    final code = c?['consumerCode'] as String? ?? p?['consumerCode'] ?? '—';
    final division = c?['division'] as String? ?? '—';
    final ward = c?['ward'] as String? ?? p?['ward'] ?? '—';
    final union = c?['unionName'] as String? ?? '—';
    final upazila = c?['upazila'] as String? ?? '—';

    final rawCardStatus = card?['cardStatus'] as String? ?? '—';
    final cardStatusColor = rawCardStatus == 'Active'
        ? const Color(0xFF28a745)
        : const Color(0xFFdc3545);

    final rawQrStatus = qr?['qrStatus'] as String? ?? '—';
    final qrStatusColor =
        rawQrStatus == 'Valid' ? const Color(0xFF28a745) : const Color(0xFFdc3545);

    String expiryLabel;
    if (_preview != null) {
      final validTo = qr?['validTo'];
      if (validTo != null) {
        try {
          final d = DateTime.parse(validTo as String);
          expiryLabel = '${d.day}/${d.month}/${d.year}';
        } catch (_) {
          expiryLabel = validTo.toString();
        }
      } else {
        expiryLabel = '—';
      }
    } else {
      expiryLabel = p?['expiryDate'] ?? '—';
    }

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE0E0E0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              color: Color(0xFF0d2b3a),
              borderRadius: BorderRadius.vertical(top: Radius.circular(11)),
            ),
            child: Row(
              children: const [
                Icon(Icons.person_outline, color: Colors.white70, size: 20),
                SizedBox(width: 8),
                Text(
                  'গ্রাহকের তথ্য',
                  style: TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          _infoRow('নাম', name, Icons.person),
          _sep(),
          _infoRow('কোড', code, Icons.qr_code),
          _sep(),
          _infoRow('বিভাগ', division, Icons.map_outlined),
          _sep(),
          _infoRow('ওয়ার্ড', ward, Icons.location_on_outlined),
          _sep(),
          _infoRow('ইউনিয়ন', union, Icons.account_balance_outlined),
          _sep(),
          _infoRow('উপজেলা', upazila, Icons.location_city_outlined),
          _sep(),
          _badgeRow('কার্ড স্ট্যাটাস', _banglaStatus(rawCardStatus),
              cardStatusColor, Icons.credit_card),
          _sep(),
          _badgeRow('কিউআর স্ট্যাটাস', _banglaQrStatus(rawQrStatus),
              qrStatusColor, Icons.qr_code_2),
          _sep(),
          _infoRow('মেয়াদ', expiryLabel, Icons.calendar_today_outlined),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF888888)),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Text(label,
                style: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 13,
                    color: Color(0xFF666666))),
          ),
          Expanded(
            flex: 3,
            child: Text(value,
                textAlign: TextAlign.right,
                style: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1a1a2e))),
          ),
        ],
      ),
    );
  }

  Widget _badgeRow(String label, String value, Color color, IconData icon) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF888888)),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Text(label,
                style: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 13,
                    color: Color(0xFF666666))),
          ),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: color.withOpacity(0.4)),
            ),
            child: Text(value,
                style: TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: color)),
          ),
        ],
      ),
    );
  }

  Widget _sep() =>
      const Divider(height: 1, indent: 16, endIndent: 16, color: Color(0xFFF0F0F0));

  String _banglaStatus(String s) {
    switch (s) {
      case 'Active': return 'সক্রিয়';
      case 'Inactive': return 'নিষ্ক্রিয়';
      case 'Revoked': return 'বাতিল';
      default: return s.isEmpty ? '—' : s;
    }
  }

  String _banglaQrStatus(String s) {
    switch (s) {
      case 'Valid': return 'বৈধ';
      case 'Expired': return 'মেয়াদোত্তীর্ণ';
      case 'Revoked': return 'বাতিল';
      case 'Invalid': return 'অবৈধ';
      default: return s.isEmpty ? '—' : s;
    }
  }
}
