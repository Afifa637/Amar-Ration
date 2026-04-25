import 'package:flutter/material.dart';
import 'qr_scanner_screen.dart';

class ConsumerDetailsScreen extends StatelessWidget {
  final String rawPayload;
  final Map<String, String>? parsedData;

  const ConsumerDetailsScreen({
    Key? key,
    required this.rawPayload,
    this.parsedData,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final isValid = parsedData != null;
    final isExpired = parsedData?['expired'] == 'true';

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
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
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Status banner
            _buildStatusBanner(isValid, isExpired),

            const SizedBox(height: 16),

            // Raw payload card
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _buildSectionCard(
                title: 'স্কেন করা ডেটা (Raw Payload)',
                icon: Icons.qr_code_2,
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1a1a2e),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: SelectableText(
                    rawPayload,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 14,
                      color: Color(0xFF00FF88),
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 16),

            // Parsed fields (if valid ARC QR)
            if (isValid) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _buildSectionCard(
                  title: 'পার্স করা তথ্য (Decoded Fields)',
                  icon: Icons.lock_open,
                  child: Column(
                    children: [
                      _buildFieldRow('প্রিফিক্স (Prefix)', 'ARC', Icons.tag),
                      _buildDivider(),
                      _buildFieldRow('গ্রাহক কোড (Consumer Code)', parsedData!['consumerCode']!, Icons.person),
                      _buildDivider(),
                      _buildFieldRow('ওয়ার্ড (Ward)', parsedData!['ward']!, Icons.location_on),
                      _buildDivider(),
                      _buildFieldRow('ক্যাটাগরি (Category)', parsedData!['category']!, Icons.category),
                      _buildDivider(),
                      _buildFieldRow(
                        'মেয়াদ (Expiry)',
                        parsedData!['expiryDate']!,
                        Icons.calendar_today,
                        valueColor: isExpired ? const Color(0xFFdc3545) : const Color(0xFF28a745),
                        suffix: isExpired ? ' (মেয়াদোত্তীর্ণ)' : ' (বৈধ)',
                      ),
                      _buildDivider(),
                      _buildFieldRow('HMAC স্বাক্ষর (Signature)', parsedData!['hmac']!, Icons.fingerprint),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Format explanation
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _buildSectionCard(
                  title: 'QR ফরম্যাট ব্যাখ্যা',
                  icon: Icons.info_outline,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildFormatSegment('ARC', 'প্রিফিক্স', const Color(0xFF6C63FF)),
                      _buildFormatSegment(parsedData!['consumerCode']!, 'গ্রাহক কোড', const Color(0xFF00BCD4)),
                      _buildFormatSegment(parsedData!['ward']!, 'ওয়ার্ড', const Color(0xFFFF9800)),
                      _buildFormatSegment(parsedData!['category']!, 'ক্যাটাগরি', const Color(0xFF4CAF50)),
                      _buildFormatSegment(parsedData!['expiryRaw']!, 'মেয়াদ', const Color(0xFFE91E63)),
                      _buildFormatSegment(parsedData!['hmac']!, 'HMAC', const Color(0xFF9C27B0)),
                    ],
                  ),
                ),
              ),
            ] else ...[
              // Invalid QR
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _buildSectionCard(
                  title: 'পার্সিং ব্যর্থ',
                  icon: Icons.error_outline,
                  child: const Text(
                    'এই QR কোডটি আমার রেশন (ARC) ফরম্যাটে নেই।\n\nপ্রত্যাশিত ফরম্যাট:\nARC:consumerCode:ward:category:expiryYYYYMMDD:hmac',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 13,
                      color: Color(0xFF666666),
                      height: 1.6,
                    ),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 24),

            // Scan again button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (context) => const QRScannerScreen()),
                    );
                  },
                  icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
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
                    backgroundColor: const Color(0xFF1f77b4),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBanner(bool isValid, bool isExpired) {
    Color bgColor;
    Color borderColor;
    IconData icon;
    String title;
    String message;

    if (!isValid) {
      bgColor = const Color(0xFFF8F0F0);
      borderColor = const Color(0xFFdc3545);
      icon = Icons.cancel;
      title = 'অচেনা QR কোড';
      message = 'এই QR কোডটি আমার রেশন সিস্টেমের নয়';
    } else if (isExpired) {
      bgColor = const Color(0xFFFFF8F0);
      borderColor = const Color(0xFFFFC107);
      icon = Icons.warning_amber_rounded;
      title = 'মেয়াদোত্তীর্ণ';
      message = 'এই রেশন কার্ডের QR কোডের মেয়াদ শেষ হয়ে গেছে';
    } else {
      bgColor = const Color(0xFFF0F8F0);
      borderColor = const Color(0xFF28a745);
      icon = Icons.verified;
      title = 'বৈধ ARC QR কোড';
      message = 'এই QR কোডটি সফলভাবে পার্স করা হয়েছে';
    }

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: bgColor,
        border: Border.all(color: borderColor, width: 2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(icon, size: 56, color: borderColor),
          const SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: borderColor,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 13,
              color: Color(0xFF555555),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: const Color(0xFF1f77b4), size: 20),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF333333),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _buildFieldRow(String label, String value, IconData icon,
      {Color? valueColor, String? suffix}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF888888)),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: const TextStyle(
                fontFamily: 'Anek Bangla',
                fontSize: 12,
                color: Color(0xFF888888),
              ),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              '$value${suffix ?? ''}',
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: valueColor ?? const Color(0xFF222222),
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDivider() {
    return const Divider(height: 1, color: Color(0xFFF0F0F0));
  }

  Widget _buildFormatSegment(String value, String label, Color color) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(4),
              border: Border.all(color: color.withOpacity(0.3)),
            ),
            child: Text(
              value,
              style: TextStyle(
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ),
          const SizedBox(width: 12),
          const Text('→ ', style: TextStyle(color: Color(0xFFAAAAAA))),
          Text(
            label,
            style: const TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 13,
              color: Color(0xFF555555),
            ),
          ),
        ],
      ),
    );
  }
}
