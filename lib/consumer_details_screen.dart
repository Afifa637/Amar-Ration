import 'package:flutter/material.dart';
import 'qr_scanner_screen.dart';

class ConsumerDetailsScreen extends StatefulWidget {
  final String status; // 'eligible', 'not_registered', 'not_eligible'
  final String consumerName;
  final String consumerPhone;
  final String? lastCollection;

  const ConsumerDetailsScreen({
    Key? key,
    required this.status,
    required this.consumerName,
    required this.consumerPhone,
    this.lastCollection,
  }) : super(key: key);

  @override
  State<ConsumerDetailsScreen> createState() => _ConsumerDetailsScreenState();
}

class _ConsumerDetailsScreenState extends State<ConsumerDetailsScreen> {
  @override
  Widget build(BuildContext context) {
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
          onPressed: () {
            Navigator.pop(context);
          },
        ),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Status Container
            _buildStatusContainer(),

            const SizedBox(height: 24),

            // Consumer Information
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'গ্রাহক তথ্য',
                    style: TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF333333),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildInfoCard(
                    icon: Icons.person,
                    label: 'নাম',
                    value: widget.consumerName,
                  ),
                  const SizedBox(height: 12),
                  _buildInfoCard(
                    icon: Icons.phone,
                    label: 'ফোন',
                    value: widget.consumerPhone,
                  ),
                  const SizedBox(height: 12),
                  _buildInfoCard(
                    icon: Icons.calendar_today,
                    label: 'তারিখ',
                    value: _getCurrentDate(),
                  ),
                  if (widget.status == 'not_eligible' && widget.lastCollection != null) ...[
                    const SizedBox(height: 12),
                    _buildInfoCard(
                      icon: Icons.history,
                      label: 'শেষ সংগ্রহ',
                      value: widget.lastCollection!,
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 32),

            // Action Button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton(
                  onPressed: () {
                    if (widget.status == 'not_registered') {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const QRScannerScreen(),
                        ),
                      );
                    } else {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const QRScannerScreen(),
                        ),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: widget.status == 'not_registered'
                        ? const Color(0xFF1f77b4)
                        : const Color(0xFF28a745),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(6),
                    ),
                    elevation: 2,
                  ),
                  child: Text(
                    widget.status == 'not_registered'
                        ? 'পুনরায় চেষ্টা করুন'
                        : 'নতুন স্কেন',
                    style: const TextStyle(
                      fontFamily: 'Anek Bangla',
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusContainer() {
    late Color backgroundColor;
    late Color borderColor;
    late IconData icon;
    late String title;
    late String message;

    if (widget.status == 'eligible') {
      backgroundColor = const Color(0xFFF0F8F0);
      borderColor = const Color(0xFF28a745);
      icon = Icons.check_circle;
      title = 'সফল!';
      message = 'গ্রাহক আজ খাদ্য সংগ্রহের যোগ্য';
    } else if (widget.status == 'not_registered') {
      backgroundColor = const Color(0xFFF8F0F0);
      borderColor = const Color(0xFFdc3545);
      icon = Icons.cancel;
      title = 'ব্যর্থ';
      message = 'এই গ্রাহক সিস্টেমে নিবন্ধিত নয়';
    } else {
      // not_eligible
      backgroundColor = const Color(0xFFFFF8F0);
      borderColor = const Color(0xFFFFC107);
      icon = Icons.warning;
      title = 'অযোগ্য';
      message = 'এই গ্রাহক আজকের জন্য খাদ্য সংগ্রহের যোগ্য নয়';
    }

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: backgroundColor,
        border: Border.all(color: borderColor, width: 2),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            size: 64,
            color: borderColor,
          ),
          const SizedBox(height: 16),
          Text(
            title,
            style: TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: borderColor,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 14,
              color: Color(0xFF333333),
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard({
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFEFEFEF)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF1f77b4), size: 24),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 12,
                    color: Color(0xFF999999),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontFamily: 'Anek Bangla',
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF333333),
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _getCurrentDate() {
    final now = DateTime.now();
    final bengaliMonths = [
      'জানুয়ারি',
      'ফেব্রুয়ারি',
      'মার্চ',
      'এপ্রিল',
      'মে',
      'জুন',
      'জুলাই',
      'আগস্ট',
      'সেপ্টেম্বর',
      'অক্টোবর',
      'নভেম্বর',
      'ডিসেম্বর',
    ];

    final bengaliDay = _engToBengali(now.day.toString());
    final bengaliMonth = bengaliMonths[now.month - 1];
    final bengaliYear = _engToBengali(now.year.toString());

    return '$bengaliDay $bengaliMonth $bengaliYear';
  }

  String _engToBengali(String english) {
    const bengaliNumbers = {
      '0': '০',
      '1': '১',
      '2': '২',
      '3': '३',
      '4': '४',
      '5': '५',
      '6': '६',
      '7': '७',
      '8': '८',
      '9': '९',
    };

    String result = '';
    for (var char in english.split('')) {
      result += bengaliNumbers[char] ?? char;
    }
    return result;
  }
}
