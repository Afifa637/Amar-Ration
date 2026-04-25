import 'package:flutter/material.dart';
import 'services/scan_history_service.dart';

class ScanHistoryScreen extends StatefulWidget {
  const ScanHistoryScreen({Key? key}) : super(key: key);

  @override
  State<ScanHistoryScreen> createState() => _ScanHistoryScreenState();
}

class _ScanHistoryScreenState extends State<ScanHistoryScreen> {
  String _selectedFilter = 'Today'; // Today, Week, All
  String _searchQuery = '';
  late TextEditingController _searchController;
  List<Map<String, dynamic>> allScans = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final history = await ScanHistoryService.loadHistory();
    if (mounted) {
      setState(() {
        allScans = history;
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> _getFilteredScans() {
    List<Map<String, dynamic>> filtered = allScans.where((scan) {
      final ts = scan['timestamp'] as String? ?? '';
      final dt = DateTime.tryParse(ts)?.toLocal();
      if (dt == null) return _selectedFilter == 'All';
      final now = DateTime.now();
      if (_selectedFilter == 'Today') {
        return dt.year == now.year && dt.month == now.month && dt.day == now.day;
      } else if (_selectedFilter == 'Week') {
        return dt.isAfter(now.subtract(const Duration(days: 7)));
      }
      return true;
    }).toList();

    // Apply search filter
    if (_searchQuery.isNotEmpty) {
      final q = _searchQuery.toLowerCase();
      filtered = filtered
          .where((scan) =>
              (scan['consumerCode'] as String? ?? '')
                  .toLowerCase()
                  .contains(q))
          .toList();
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final filteredScans = _getFilteredScans();

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1f77b4),
        elevation: 0,
        title: const Text(
          'স্কেন ইতিহাস',
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
        actions: [
          if (allScans.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep, color: Colors.white),
              tooltip: 'সব মুছুন',
              onPressed: () async {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('ইতিহাস মুছুন',
                        style: TextStyle(fontFamily: 'Anek Bangla')),
                    content: const Text('সব স্কেন ইতিহাস মুছে ফেলা হবে।',
                        style: TextStyle(fontFamily: 'Anek Bangla')),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: const Text('বাতিল',
                            style: TextStyle(fontFamily: 'Anek Bangla')),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('মুছুন',
                            style: TextStyle(
                                fontFamily: 'Anek Bangla',
                                color: Color(0xFFdc3545))),
                      ),
                    ],
                  ),
                );
                if (confirm == true) {
                  await ScanHistoryService.clearHistory();
                  _loadHistory();
                }
              },
            ),
        ],
      ),
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
              },
              decoration: InputDecoration(
                hintText: 'গ্রাহক কোড খুঁজুন',
                hintStyle: const TextStyle(
                  fontFamily: 'Anek Bangla',
                  color: Color(0xFFAAAAAA),
                ),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF1f77b4)),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          setState(() {
                            _searchController.clear();
                            _searchQuery = '';
                          });
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFFCCCCCC)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF1f77b4), width: 2),
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              ),
            ),
          ),

          // Filter Tabs
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _buildFilterButton('Today', 'আজ'),
                const SizedBox(width: 12),
                _buildFilterButton('Week', 'এই সপ্তাহ'),
                const SizedBox(width: 12),
                _buildFilterButton('All', 'সব'),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Scan History List
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : filteredScans.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.inbox, size: 60, color: Color(0xFFCCCCCC)),
                        SizedBox(height: 12),
                        Text(
                          'কোনো স্কেন রেকর্ড নেই',
                          style: TextStyle(
                            fontFamily: 'Anek Bangla',
                            fontSize: 16,
                            color: Color(0xFF999999),
                          ),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: filteredScans.length,
                    itemBuilder: (context, index) {
                      final scan = filteredScans[index];
                      final status = scan['status'] as String? ?? 'অচেনা';
                      final isSuccess = status == 'সফল';
                      final isExpired = status == 'মেয়াদোত্তীর্ণ';
                      final statusColor = isSuccess
                          ? const Color(0xFF28a745)
                          : isExpired
                              ? const Color(0xFFFF9800)
                              : const Color(0xFFdc3545);
                      final bgColor = isSuccess
                          ? const Color(0xFFF0F8F0)
                          : isExpired
                              ? const Color(0xFFFFF8F0)
                              : const Color(0xFFFFF0F0);
                      final borderColor = isSuccess
                          ? const Color(0xFFE8F5E9)
                          : isExpired
                              ? const Color(0xFFFFE0B2)
                              : const Color(0xFFFFEBEE);
                      final statusIcon = isSuccess
                          ? Icons.check_circle
                          : isExpired
                              ? Icons.warning_amber_rounded
                              : Icons.cancel;
                      final consumerCode =
                          scan['consumerCode'] as String? ?? '-';
                      final ward = scan['ward'] as String? ?? '-';
                      final category = scan['category'] as String? ?? '-';
                      final ts = scan['timestamp'] as String? ?? '';
                      final formattedTime =
                          ScanHistoryService.formatTimestamp(ts);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border.all(color: borderColor, width: 1.5),
                          borderRadius: BorderRadius.circular(8),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.04),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        child: Row(
                          children: [
                            // Status Icon
                            Container(
                              width: 44,
                              height: 44,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: bgColor,
                              ),
                              child: Center(
                                child: Icon(
                                  statusIcon,
                                  color: statusColor,
                                  size: 24,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),

                            // Consumer Info
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    consumerCode == '-'
                                        ? 'অচেনা QR'
                                        : consumerCode,
                                    style: const TextStyle(
                                      fontFamily: 'Anek Bangla',
                                      fontSize: 14,
                                      fontWeight: FontWeight.bold,
                                      color: Color(0xFF333333),
                                    ),
                                  ),
                                  if (consumerCode != '-') ...[  
                                    const SizedBox(height: 4),
                                    Text(
                                      'ওয়ার্ড: $ward · ক্যাটাগরি: $category',
                                      style: const TextStyle(
                                        fontFamily: 'Anek Bangla',
                                        fontSize: 12,
                                        color: Color(0xFF999999),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 4),
                                  Text(
                                    formattedTime,
                                    style: const TextStyle(
                                      fontFamily: 'Anek Bangla',
                                      fontSize: 11,
                                      color: Color(0xFFCCCCCC),
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Status Badge
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: bgColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontFamily: 'Anek Bangla',
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: statusColor,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterButton(String value, String label) {
    final isSelected = _selectedFilter == value;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _selectedFilter = value;
          });
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF1f77b4) : Colors.white,
            border: Border.all(
              color: isSelected ? const Color(0xFF1f77b4) : const Color(0xFFCCCCCC),
              width: 1,
            ),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: 'Anek Bangla',
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : const Color(0xFF666666),
            ),
          ),
        ),
      ),
    );
  }
}
