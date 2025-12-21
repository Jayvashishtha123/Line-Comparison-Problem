package Using_Oops;

public class Line implements Comparable<Line> {
    private final Point startPoint;
    private final Point endPoint;

    public Line(Point startPoint, Point endPoint) {
        this.startPoint = startPoint;
        this.endPoint = endPoint;
    }

    public double length() {
        int dx = endPoint.getX() - startPoint.getX();
        int dy = endPoint.getY() - startPoint.getY();
        return Math.sqrt(dx * dx + dy * dy);
    }

    @Override
    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (!(obj instanceof Line)) {
            return false;
        }
        Line other = (Line) obj;
        return Double.compare(this.length(), other.length()) == 0;
    }

    @Override
    public int compareTo(Line other) {
        return Double.compare(this.length(), other.length());
    }
}

