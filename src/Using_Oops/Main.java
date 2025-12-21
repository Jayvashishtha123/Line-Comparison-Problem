package Using_Oops;

public class Main {
    public static void main(String[] args) {
        Point p1 = new Point(0, 0);
        Point p2 = new Point(4, 4);

        Point p3 = new Point(4, 4);
        Point p4 = new Point(8, 8);

        Line line1 = new Line(p1, p2);
        Line line2 = new Line(p3, p4);

        if(line1.equals(line2)){
            System.out.println("The two points are the same");
        }else{
            System.out.println("The two points are not the same");
        }

        if(line1.compareTo(line2)==0){
            System.out.println("The two points are the same");
        }else{
            System.out.println("The two points are not the same");
        }

    }
}
