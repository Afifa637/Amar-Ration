import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class ScanHistoryService {
  static const String _key = 'scan_history';

  static Future<List<Map<String, dynamic>>> loadHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  static Future<void> addRecord(Map<String, dynamic> record) async {
    final prefs = await SharedPreferences.getInstance();
    final existing = await loadHistory();
    existing.insert(0, record); // newest first
    await prefs.setString(_key, jsonEncode(existing));
  }

  static Future<void> clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }

  /// Build a record from a QR scan result.
  static Map<String, dynamic> buildRecord({
    required String rawPayload,
    required Map<String, String>? parsedData,
  }) {
    String status;
    if (parsedData == null) {
      status = 'অচেনা';
    } else if (parsedData['expired'] == 'true') {
      status = 'মেয়াদোত্তীর্ণ';
    } else {
      status = 'সফল';
    }

    return {
      'consumerCode': parsedData?['consumerCode'] ?? '-',
      'ward': parsedData?['ward'] ?? '-',
      'category': parsedData?['category'] ?? '-',
      'expiryDate': parsedData?['expiryDate'] ?? '-',
      'status': status,
      'timestamp': DateTime.now().toIso8601String(),
      'rawPayload': rawPayload,
    };
  }

  static String formatTimestamp(String isoTimestamp) {
    final dt = DateTime.tryParse(isoTimestamp);
    if (dt == null) return isoTimestamp;
    final local = dt.toLocal();
    final months = [
      'জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে',
    ];
    final hour = local.hour;
    final minute = local.minute.toString().padLeft(2, '0');
    final amPm = hour < 12 ? 'এএম' : 'পিএম';
    final hour12 = hour % 12 == 0 ? 12 : hour % 12;
    return '${local.day} ${months[local.month - 1]}, $hour12:$minute $amPm';
  }
}
