import java.util.Scanner;
public class UC03 {
    // Method to calculate line length
    static Double calculateLength(double x1, double y1, double x2, double y2) {
        return Math.sqrt(
                Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)
        );
    }
public static void main(String[] args) {
    Scanner sc = new Scanner(System.in);

    // Input for Line 1
    System.out.println("Enter coordinates for Line 1 (x1 y1 x2 y2):");
    double x1 = sc.nextDouble();
    double y1 = sc.nextDouble();
    double x2 = sc.nextDouble();
    double y2 = sc.nextDouble();

    // Input for Line 2
    System.out.println("Enter coordinates for Line 2 (x3 y3 x4 y4):");
    double x3 = sc.nextDouble();
    double y3 = sc.nextDouble();
    double x4 = sc.nextDouble();
    double y4 = sc.nextDouble();
    // Calculate lengths
    Double length1 = calculateLength(x1, y1, x2, y2);
    Double length2 = calculateLength(x3, y3, x4, y4);

    // Compare lengths using compareTo()
    int result = length1.compareTo(length2);

    if (result == 0) {
        System.out.println("Both lines are equal in length.");
    } else if (result > 0) {
        System.out.println("Line 1 is greater than Line 2.");
    } else {
        System.out.println("Line 1 is less than Line 2.");
    }
}
}
