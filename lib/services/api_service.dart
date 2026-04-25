import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://amar-ration.onrender.com/api';

  static const Map<String, String> _jsonHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json',
  };

  // ─── Token helpers ────────────────────────────────────────────────────────

  static Future<String?> _getAccessToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('access_token');
  }

  static Future<String?> _getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('refresh_token');
  }

  static Future<void> _saveTokens(String access, String refresh) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('access_token', access);
    await prefs.setString('refresh_token', refresh);
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('access_token');
    await prefs.remove('refresh_token');
    await prefs.remove('user_id');
    await prefs.remove('user_name');
    await prefs.remove('user_email');
    await prefs.remove('amar_ration_auth');
  }

  // ─── JSON decode with UTF-8 support ──────────────────────────────────────

  static Map<String, dynamic> _decodeJson(http.Response response) {
    final body = utf8.decode(response.bodyBytes);
    return jsonDecode(body) as Map<String, dynamic>;
  }

  // ─── Refresh access token ─────────────────────────────────────────────────

  static Future<String?> refreshAccessToken() async {
    final refresh = await _getRefreshToken();
    if (refresh == null) return null;

    final response = await http.post(
      Uri.parse('$baseUrl/auth/refresh'),
      headers: _jsonHeaders,
      body: jsonEncode({'refreshToken': refresh}),
    );

    if (response.statusCode == 200) {
      final json = _decodeJson(response);
      if (json['success'] == true) {
        final newAccess = json['data']?['accessToken'] as String?;
        final newRefresh = json['data']?['refreshToken'] as String?;
        if (newAccess != null && newRefresh != null) {
          await _saveTokens(newAccess, newRefresh);
          return newAccess;
        }
      }
    }
    return null;
  }

  // ─── Authorized request with auto-refresh ────────────────────────────────

  static Future<http.Response> _authorizedRequest(
    Future<http.Response> Function(String token) request,
  ) async {
    String? token = await _getAccessToken();
    if (token == null) throw ApiException(statusCode: 401, message: 'অনুমোদিত নয়', code: 'UNAUTHORIZED');

    http.Response response = await request(token);

    if (response.statusCode == 401) {
      token = await refreshAccessToken();
      if (token == null) {
        throw ApiException(statusCode: 401, message: 'সেশন মেয়াদ শেষ, আবার লগইন করুন', code: 'SESSION_EXPIRED');
      }
      response = await request(token);
    }

    return response;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  static Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
    String userType = 'FieldUser',
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: _jsonHeaders,
      body: jsonEncode({
        'identifier': identifier.trim(),
        'password': password,
        'userType': userType,
      }),
    );

    final json = _decodeJson(response);

    if (response.statusCode == 200 && json['success'] == true) {
      final data = json['data'] as Map<String, dynamic>? ?? {};
      final accessToken = data['accessToken'] as String?;
      final refreshToken = data['refreshToken'] as String?;
      if (accessToken != null && refreshToken != null) {
        await _saveTokens(accessToken, refreshToken);
        final prefs = await SharedPreferences.getInstance();
        final user = data['user'] as Map<String, dynamic>? ?? {};
        if (user['_id'] != null) await prefs.setString('user_id', user['_id']);
        if (user['name'] != null) await prefs.setString('user_name', user['name']);
        if (user['email'] != null) await prefs.setString('user_email', user['email']);
        await prefs.setString('amar_ration_auth', accessToken);
      }
      return json;
    }

    final code = json['code'] as String? ?? '';
    throw ApiException(
      statusCode: response.statusCode,
      message: _bengaliErrorMessage(code, json['message'] ?? 'লগইন ব্যর্থ হয়েছে'),
      code: code,
    );
  }

  static Future<Map<String, dynamic>> applyAsFieldDistributor({
    required String name,
    required String email,
    required String phone,
    required String wardNo,
    required String division,
    required String district,
    required String upazila,
    required String unionName,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/signup'),
      headers: _jsonHeaders,
      body: jsonEncode({
        'userType': 'FieldUser',
        'name': name,
        'email': email,
        'phone': phone,
        'wardNo': wardNo,
        'division': division,
        'district': district,
        'upazila': upazila,
        'unionName': unionName,
      }),
    );

    final json = _decodeJson(response);

    if ((response.statusCode == 200 || response.statusCode == 201) && json['success'] == true) {
      return json;
    }

    final code = json['code'] as String? ?? '';
    throw ApiException(
      statusCode: response.statusCode,
      message: _bengaliErrorMessage(code, json['message'] ?? 'আবেদন ব্যর্থ হয়েছে'),
      code: code,
    );
  }

  static Future<Map<String, dynamic>> getMe() async {
    final response = await _authorizedRequest((token) => http.get(
          Uri.parse('$baseUrl/auth/me'),
          headers: {..._jsonHeaders, 'Authorization': 'Bearer $token'},
        ));

    final json = _decodeJson(response);

    if (response.statusCode == 200 && json['success'] == true) {
      return json;
    }

    final code = json['code'] as String? ?? '';
    throw ApiException(
      statusCode: response.statusCode,
      message: _bengaliErrorMessage(code, json['message'] ?? 'তথ্য লোড ব্যর্থ'),
      code: code,
    );
  }

  // ─── Consumer preview (read-only, no token issued) ───────────────────────

  static Future<Map<String, dynamic>> consumerPreview(String qrPayload) async {
    final encoded = Uri.encodeQueryComponent(qrPayload);
    final response = await _authorizedRequest(
      (token) => http.get(
        Uri.parse('$baseUrl/field/consumer-preview?qrPayload=$encoded'),
        headers: {..._jsonHeaders, 'Authorization': 'Bearer $token'},
      ),
    );

    final json = _decodeJson(response);

    if (response.statusCode == 200 && json['success'] == true) {
      return json['data'] as Map<String, dynamic>;
    }

    final code = json['code'] as String? ?? '';
    throw ApiException(
      statusCode: response.statusCode,
      message: json['message'] as String? ?? 'তথ্য লোড ব্যর্থ',
      code: code,
    );
  }

  static Future<void> logout() async {    try {
      final token = await _getAccessToken();
      if (token != null) {
        await http.post(
          Uri.parse('$baseUrl/auth/logout'),
          headers: {..._jsonHeaders, 'Authorization': 'Bearer $token'},
        );
      }
    } catch (_) {
      // ignore network errors on logout
    } finally {
      await clearSession();
    }
  }

  // ─── Bengali error messages ───────────────────────────────────────────────

  static String _bengaliErrorMessage(String code, String fallback) {
    const messages = {
      'INVALID_CREDENTIALS': 'ইউজার আইডি বা পাসওয়ার্ড সঠিক নয়',
      'USER_NOT_FOUND': 'ব্যবহারকারী পাওয়া যায়নি',
      'PENDING_APPROVAL': 'আপনার আবেদন অনুমোদনের অপেক্ষায় আছে',
      'ACCOUNT_INACTIVE': 'আপনার অ্যাকাউন্ট নিষ্ক্রিয়',
      'MUST_CHANGE_PASSWORD': 'নিরাপত্তার জন্য পাসওয়ার্ড পরিবর্তন করুন',
      'EMAIL_EXISTS': 'এই ইমেইল ইতিমধ্যে নিবন্ধিত',
      'PHONE_EXISTS': 'এই ফোন নম্বর ইতিমধ্যে নিবন্ধিত',
      'UNAUTHORIZED': 'অনুমোদিত নয়',
      'SESSION_EXPIRED': 'সেশন মেয়াদ শেষ, আবার লগইন করুন',
    };
    return messages[code] ?? fallback;
  }
}

// ─── ApiException ─────────────────────────────────────────────────────────────

class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String code;

  ApiException({required this.statusCode, required this.message, this.code = ''});

  bool get isPendingApproval => code == 'PENDING_APPROVAL';
  bool get mustChangePassword => code == 'MUST_CHANGE_PASSWORD';

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}