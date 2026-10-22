const { query } = require('../config/db');
const logger = require('../utils/logger');

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. KPI Counts
    const customerCountRes = await query('SELECT COUNT(*) as count FROM customers');
    const invoiceCountRes = await query('SELECT COUNT(*) as count FROM invoices');
    const revenueRes = await query("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status = 'PAID'");
    const pendingRevenueRes = await query("SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE status IN ('SENT', 'OVERDUE')");

    // 2. Status breakdown
    const statusRes = await query(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as sum_amount
      FROM invoices
      GROUP BY status
    `);

    // 3. Recent 5 invoices
    const recentInvoicesRes = await query(`
      SELECT i.*, c.name as customer_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ORDER BY i.id DESC
      LIMIT 5
    `);

    // 4. Recent 5 payments
    const recentPaymentsRes = await query(`
      SELECT p.*, i.invoice_number, c.name as customer_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      ORDER BY p.id DESC
      LIMIT 5
    `);

    // 5. Monthly revenue (last 6 months - only PAID invoices count as realized revenue)
    const monthlyRes = await query(`
      SELECT TO_CHAR(issue_date, 'YYYY-MM') as month,
             COUNT(*) as invoice_count,
             COALESCE(SUM(total_amount), 0) as total_amount
      FROM invoices
      WHERE status = 'PAID'
      GROUP BY TO_CHAR(issue_date, 'YYYY-MM')
      ORDER BY month ASC
      LIMIT 6
    `);

    res.json({
      success: true,
      data: {
        stats: {
          totalCustomers: parseInt(customerCountRes.rows[0].count, 10),
          totalInvoices: parseInt(invoiceCountRes.rows[0].count, 10),
          totalRevenue: parseFloat(revenueRes.rows[0].total),
          pendingRevenue: parseFloat(pendingRevenueRes.rows[0].total),
        },
        statusBreakdown: statusRes.rows,
        recentInvoices: recentInvoicesRes.rows,
        recentPayments: recentPaymentsRes.rows,
        monthlyRevenue: monthlyRes.rows,
      }
    });
  } catch (err) {
    logger.error({ message: 'Error fetching dashboard stats', error: err.message });
    res.status(500).json({ success: false, message: 'Lỗi tải dữ liệu dashboard' });
  }
};
