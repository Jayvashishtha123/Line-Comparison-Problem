import java.util.Scanner;
public class UC02 {
    // Method to calculate length of a line
    static Double calculateLength(double x1, double y1, double x2, double y2) {
        return Math.sqrt(
                Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
        );
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);

        // Line 1 input
        System.out.println("Enter coordinates for Line 1:");
        double x1 = sc.nextDouble();
        double y1 = sc.nextDouble();
        double x2 = sc.nextDouble();
        double y2 = sc.nextDouble();

        // Line 2 input
        System.out.println("Enter coordinates for Line 2:");
        double x3 = sc.nextDouble();
        double y3 = sc.nextDouble();
        double x4 = sc.nextDouble();
        double y4 = sc.nextDouble();

        // Calculate lengths
        Double length1 = calculateLength(x1, y1, x2, y2);
        Double length2 = calculateLength(x3, y3, x4, y4);

        // Check equality using equals()
        if (length1.equals(length2)) {
            System.out.println("Both lines are equal in length.");
        } else {
            System.out.println("Both lines are NOT equal in length.");
        }
    }
}
